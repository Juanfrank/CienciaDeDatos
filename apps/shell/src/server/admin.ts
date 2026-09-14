import type { SchemaDescriptor } from '@app/data-contracts';
import { getManagedTree } from './context';
import { expansionsCount } from './audit';
import {
  type AccessScope,
  type AppRole,
  type Actor,
  type FolderNode,
  type ManagedTree,
  type LastAdministratorDenial,
  type ModulePackage,
  type NavNode,
  type Team,
  type TreeOperation,
  PermissionError,
  administratorsOf,
  applyTreeOperation,
  assertCan,
  buildNavigationView,
  canTeamAccessModule,
  collectModuleIds,
  dimensionKey,
  findNode,
  isFolder,
  resolveEffectiveScope,
  wouldExpand,
  wouldLeaveNoAdministrator,
} from '@app/access-control';
import { SCHEMA_CACHE_KEY } from '@app/caching';
import { cacheL2, getGeneralTree } from './context';
import { governance } from './governance';
import { changeRecord, treeEventRecord } from './audit';
import type { ShellSession } from './session';

/** Servicio del panel de administracion — seccion 4.10.8. */

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

/** Rol de aplicacion mas alto que una persona tiene en CUALQUIERA de sus equipos. */
export async function roleMoreHeightOf(userId: string): Promise<AppRole> {
  const equipos = await governance.listTeams();
  const roles = equipos.flatMap((t) =>
    t.members.filter((m) => m.userId === userId).map((m) => m.role),
  );
  if (roles.includes('administrador')) return 'administrador';
  if (roles.includes('colaborador')) return 'colaborador';
  return 'visor';
}

/** Guardian de todas las rutas del panel. */
export async function assertAdmin(sesion: ShellSession | null): Promise<Actor> {
  // Sin sesion es 401, no 403: "no se quien eres" y "se quien eres y no puedes" son respuestas
  // distintas, y devolver 403 a quien no ha entrado le hace buscar un permiso que le falta
  // cuando lo que le falta es la sesion.
  if (!sesion) throw new AdminError('Se requiere iniciar sesion.', 401);

  const role = await roleMoreHeightOf(sesion.userId);
  try {
    assertCan(role, 'ver-panel-auditoria');
  } catch (error) {
    if (error instanceof PermissionError) {
      throw new AdminError(error.message, 403, error.denial);
    }
    throw error;
  }
  return { userId: sesion.userId, role };
}

export async function isAdministrator(userId: string): Promise<boolean> {
  return await roleMoreHeightOf(userId) === 'administrador';
}

// ---------------------------------------------------------------------------
// Arbol (4.1, 4.1.2)
// ---------------------------------------------------------------------------

/** Aplica una operacion sobre la organizacion general y la persiste. */
export async function treeOperationRun(actor: Actor, op: TreeOperation): Promise<ManagedTree> {
  const resultado = applyTreeOperation(await governance.getTree(), op, actor);

  if (!resultado.ok) {
    if ('denial' in resultado) throw new AdminError(resultado.denial.reason, 403, resultado.denial);
    throw new AdminError(resultado.error, 400);
  }

  await governance.setTree(resultado.tree);
  for (const evento of resultado.audit) await treeEventRecord(evento);
  return resultado.tree;
}

/** Previsualiza el efecto de un movimiento ANTES de confirmarlo. */
export interface PrevisualizacionDeMovimiento {
  moduleIds: string[];
  beforeScope?: AccessScope;
  afterScope?: AccessScope;
  cambiaElAmbito: boolean;
}

export async function previsualizarMovimiento(
  nodeId: string,
  newParentId: string | null,
): Promise<PrevisualizacionDeMovimiento> {
  const arbol = await governance.getTree();
  const node = findNode(arbol.nodes, nodeId);
  if (!node) throw new AdminError(`El nodo '${nodeId}' no existe.`, 404);

  const padreActual = parentFind(arbol.nodes, nodeId);
  const destino = newParentId === null ? null : findNode(arbol.nodes, newParentId);
  if (newParentId !== null && (!destino || !isFolder(destino))) {
    throw new AdminError(`La carpeta destino '${newParentId}' no existe.`, 404);
  }

  const beforeScope = padreActual?.scope;
  const afterScope = destino && isFolder(destino) ? destino.scope : undefined;

  return {
    moduleIds: collectModuleIds(node),
    ...(beforeScope ? { beforeScope } : {}),
    ...(afterScope ? { afterScope } : {}),
    cambiaElAmbito: JSON.stringify(beforeScope ?? null) !== JSON.stringify(afterScope ?? null),
  };
}

/** Carpeta que contiene directamente a un nodo, o undefined si esta en la raiz. */
function parentFind(nodes: NavNode[], nodeId: string): FolderNode | undefined {
  for (const node of nodes) {
    if (!isFolder(node)) continue;
    if (node.children.some((h) => h.id === nodeId)) return node;
    const dentro = parentFind(node.children, nodeId);
    if (dentro) return dentro;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Ambitos (4.10.3) — aqui vive la puerta de ampliacion
// ---------------------------------------------------------------------------

export interface SaveScopeInput {
  actor: Actor;
  /** Que se esta editando: una carpeta del arbol, o el ambito general de un equipo. */
  destino: { tipo: 'carpeta'; nodeId: string } | { tipo: 'equipo'; teamId: string };
  scope: AccessScope;
  /** Obligatoria si el ambito nuevo AMPLIA respecto del anterior. */
  justificacion?: string;
}

export class ExpansionWithoutJustifyError extends AdminError {
  constructor(readonly dimensiones: string[]) {
    super(
      `El ambito propuesto AMPLIA el acceso en: ${dimensiones.join(', ')}. Una ampliacion exige ` +
        `una justificacion explicita y queda registrada aparte en el panel de auditoria (4.10.4).`,
      422,
      { dimensiones },
    );
    this.name = 'ExpansionWithoutJustifyError';
  }
}

/** Dimensiones en las que `propuesto` permite algo que `actual` no permitia. */
export function expandedDimensions(actual: AccessScope, propuesto: AccessScope): string[] {
  const ampliadas: string[] = [];
  for (const restriccion of actual.restrictions) {
    const clave = dimensionKey(restriccion.dimension);
    const siguiente = propuesto.restrictions.find((r) => dimensionKey(r.dimension) === clave);
    if (!siguiente) {
      ampliadas.push(`${clave} (deja de estar restringida)`);
      continue;
    }
    const permitidos = new Set(restriccion.allowedValues);
    const nuevos = siguiente.allowedValues.filter((v) => !permitidos.has(v));
    if (nuevos.length > 0) ampliadas.push(`${clave} (+${nuevos.join(', ')})`);
  }
  return ampliadas;
}

/** Guarda un ambito, cerrando la puerta que hasta ahora estaba abierta. */
export async function saveScope(input: SaveScopeInput): Promise<AccessScope> {
  const { actor, destino, scope, justificacion } = input;
  assertCan(actor.role, 'configurar-ambitos');

  const actual = await currentScope(destino);
  const amplia = wouldExpand(actual, scope);
  const motivo = justificacion?.trim() ?? '';

  if (amplia && !motivo) {
    throw new ExpansionWithoutJustifyError(expandedDimensions(actual, scope));
  }

  const guardado: AccessScope = amplia
    ? {
        restrictions: scope.restrictions,
        authorizedExpansion: {
          justification: motivo,
          authorizedBy: actor.userId,
          authorizedAt: new Date().toISOString(),
        },
      }
    : { restrictions: scope.restrictions };

  await applyScope(destino, guardado);

  await changeRecord({
    actorId: actor.userId,
    entityType: 'scope',
    entityId: destino.tipo === 'carpeta' ? destino.nodeId : destino.teamId,
    action: amplia ? 'scope-expansion' : 'update',
    before: actual,
    after: guardado,
    ...(amplia ? { justification: motivo } : {}),
    isScopeExpansion: amplia,
  });

  return guardado;
}

async function currentScope(destino: SaveScopeInput['destino']): Promise<AccessScope> {
  if (destino.tipo === 'equipo') {
    return (await governance.getTeam(destino.teamId))?.defaultScope ?? { restrictions: [] };
  }
  const node = findNode((await governance.getTree()).nodes, destino.nodeId);
  if (!node || !isFolder(node)) throw new AdminError(`La carpeta '${destino.nodeId}' no existe.`, 404);
  return node.scope ?? { restrictions: [] };
}

async function applyScope(destino: SaveScopeInput['destino'], scope: AccessScope): Promise<void> {
  if (destino.tipo === 'equipo') {
    const equipo = await governance.getTeam(destino.teamId);
    if (!equipo) throw new AdminError(`El equipo '${destino.teamId}' no existe.`, 404);
    await writeTeam({ ...equipo, defaultScope: scope });
    return;
  }

  const arbol = await governance.getTree();
  const node = findNode(arbol.nodes, destino.nodeId);
  if (!node || !isFolder(node)) throw new AdminError(`La carpeta '${destino.nodeId}' no existe.`, 404);
  node.scope = scope;
  await governance.setTree(arbol);
}

// ---------------------------------------------------------------------------
// Validacion de dimensiones contra el esquema real (4.10.8)
// ---------------------------------------------------------------------------

/** Esquema de la fuente activa, leido del CACHE. */
export async function activeScheme(): Promise<SchemaDescriptor | null> {
  try {
    return (await cacheL2.get<SchemaDescriptor>(SCHEMA_CACHE_KEY))?.value ?? null;
  } catch {
    return null;
  }
}

/** Dimensiones seleccionables en el editor de ambitos. Nunca texto libre. */
export async function availableDimensions(): Promise<
  { table: string; field: string; key: string }[]
> {
  const schema = await activeScheme();
  if (!schema) return [];
  return schema.tables.flatMap((tabla) =>
    tabla.fields
      .filter((fieldName) => !fieldName.isMeasure)
      .map((fieldName) => ({
        table: tabla.name,
        field: fieldName.name,
        key: `${tabla.name}.${fieldName.name}`,
      })),
  );
}

/** Rechaza un ambito que referencie dimensiones que no existen en el esquema activo. */
export async function validateDimensions(scope: AccessScope): Promise<string[]> {
  const available = new Set((await availableDimensions()).map((d) => d.key));
  if (available.size === 0) return [];
  return scope.restrictions
    .map((r) => dimensionKey(r.dimension))
    .filter((clave) => !available.has(clave));
}

// ---------------------------------------------------------------------------
// Equipos, membresia y paquetes (4.10.2, 4.1.3)
// ---------------------------------------------------------------------------

/** Error de la comprobacion del ultimo Administrador. */
export class LastAdministratorError extends AdminError {
  constructor(readonly denegacion: LastAdministratorDenial) {
    super(denegacion.reason, 409, denegacion);
    this.name = 'LastAdministratorError';
  }
}

/** UNICO camino por el que este servicio escribe equipos. */
async function writeTeam(equipo: Team): Promise<void> {
  const before = await governance.listTeams();
  const after = [...before.filter((t) => t.id !== equipo.id), equipo];

  const denegacion = wouldLeaveNoAdministrator(before, after);
  if (denegacion) throw new LastAdministratorError(denegacion);

  await governance.upsertTeam(equipo);
}

/** Borrado de un equipo, con la misma comprobacion. */
export async function deleteTeam(actor: Actor, teamId: string): Promise<void> {
  assertCan(actor.role, 'gestionar-equipos');

  const before = await governance.listTeams();
  const equipo = before.find((t) => t.id === teamId);
  if (!equipo) throw new AdminError(`El equipo '${teamId}' no existe.`, 404);

  const denegacion = wouldLeaveNoAdministrator(
    before,
    before.filter((t) => t.id !== teamId),
  );
  if (denegacion) throw new LastAdministratorError(denegacion);

  await governance.deleteTeam(teamId);
  await changeRecord({
    actorId: actor.userId,
    entityType: 'team',
    entityId: teamId,
    action: 'delete',
    before: equipo,
  });
}

/** Quienes administran ahora mismo. La superficie de equipos lo muestra (4.10.1). */
export async function administradores(): Promise<string[]> {
  return administratorsOf(await governance.listTeams());
}

export async function saveTeam(actor: Actor, equipo: Team): Promise<Team> {
  assertCan(actor.role, 'gestionar-equipos');
  const anterior = await governance.getTeam(equipo.id);
  await writeTeam(equipo);

  await changeRecord({
    actorId: actor.userId,
    entityType: 'team',
    entityId: equipo.id,
    action: anterior ? 'update' : 'create',
    ...(anterior ? { before: anterior } : {}),
    after: equipo,
  });

  return equipo;
}

export async function membershipChange(
  actor: Actor,
  teamId: string,
  userId: string,
  role: AppRole | null,
): Promise<Team> {
  assertCan(actor.role, 'gestionar-usuarios-y-roles');
  const equipo = await governance.getTeam(teamId);
  if (!equipo) throw new AdminError(`El equipo '${teamId}' no existe.`, 404);

  const before = { ...equipo };
  const withoutPerson = equipo.members.filter((m) => m.userId !== userId);
  const actualizado: Team = {
    ...equipo,
    members: role === null ? withoutPerson : [...withoutPerson, { userId, role }],
  };

  await writeTeam(actualizado);
  await changeRecord({
    actorId: actor.userId,
    entityType: 'membership',
    entityId: `${teamId}/${userId}`,
    action: role === null ? 'delete' : 'update',
    before: before.members,
    after: actualizado.members,
  });

  return actualizado;
}

export interface PackageValidation {
  pkg: ModulePackage;
  /** Nodos que el paquete referencia pero la audiencia destino no tiene concedidos. */
  noMostrables: { teamId: string; moduleId: string; reason: string }[];
}

/** Guarda un paquete y comprueba, contra CADA equipo que lo usa, que no cuela accesos. */
export async function savePackage(actor: Actor, pkg: ModulePackage): Promise<PackageValidation> {
  assertCan(actor.role, 'gestionar-paquetes-visuales');
  const anterior = await governance.getPackage(pkg.id);
  await governance.upsertPackage(pkg);

  const generalTree = await getGeneralTree();
  const noMostrables: PackageValidation['noMostrables'] = [];

  for (const equipo of await governance.listTeams()) {
    if (equipo.assignedPackageId !== pkg.id) continue;
    const view = buildNavigationView({ generalTree, team: equipo, pkg });
    for (const colgante of view.dangling) {
      noMostrables.push({
        teamId: equipo.id,
        moduleId: colgante.moduleId,
        reason: colgante.reason,
      });
    }
  }

  await changeRecord({
    actorId: actor.userId,
    entityType: 'package',
    entityId: pkg.id,
    action: anterior ? 'update' : 'create',
    ...(anterior ? { before: anterior } : {}),
    after: pkg,
  });

  return { pkg, noMostrables };
}

// ---------------------------------------------------------------------------
// Quien ve que (4.10.8)
// ---------------------------------------------------------------------------

export interface SeesWhoWhere {
  userId: string;
  teamId: string;
  moduleId: string;
  /** true si el equipo tiene el modulo concedido. Sin esto, el ambito es irrelevante. */
  tieneAcceso: boolean;
  scope: AccessScope;
  /** Traza legible: que capa aplico que, y desde que carpeta. */
  pasos: { capa: string; source: string; amplio: boolean; resultado: AccessScope }[];
  usoAmpliacion: boolean;
  noVeNada: boolean;
  treeTheExists: boolean;
}

/** Resuelve "quien ve que" para un usuario y un modulo. */
export async function seesWhoWhere(userId: string, teamId: string, moduleId: string): Promise<SeesWhoWhere> {
  const equipo = await governance.getTeam(teamId);
  if (!equipo) throw new AdminError(`El equipo '${teamId}' no existe.`, 404);

  const user = await governance.getUser(userId) ?? { userId };
  const generalTree = await getGeneralTree();
  const resolucion = resolveEffectiveScope({
    user: user,
    activeTeam: equipo,
    moduleId,
    generalTree,
  });

  return {
    userId,
    teamId,
    moduleId,
    tieneAcceso: canTeamAccessModule(generalTree, equipo, moduleId),
    scope: resolucion.scope,
    pasos: resolucion.steps.map((s) => ({
      capa: s.layer,
      source: s.source,
      amplio: s.expanded,
      resultado: s.result,
    })),
    usoAmpliacion: resolucion.usedAuthorizedExpansion,
    noVeNada: resolucion.deniesEverything,
    treeTheExists: resolucion.moduleExistsInGeneralTree,
  };
}

/** Los numeros que el carril de administracion muestra junto a dos secciones. */
export async function indicadoresDeAdmin(): Promise<{ ampliaciones: number; papelera: number }> {
  const [ampliaciones, arbol] = await Promise.all([expansionsCount(), getManagedTree()]);
  return { ampliaciones, papelera: arbol.trash.length };
}
