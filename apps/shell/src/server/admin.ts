import type { SchemaDescriptor } from '@app/data-contracts';
import {
  type AccessScope,
  type AppRole,
  type Actor,
  type FolderNode,
  type ManagedTree,
  type ModulePackage,
  type NavNode,
  type Team,
  type TreeOperation,
  PermissionError,
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
} from '@app/access-control';
import { SCHEMA_CACHE_KEY } from '@app/caching';
import { cacheL2, getGeneralTree } from './contexto';
import { gobierno } from './gobierno';
import { registrarCambio, registrarEventoDeArbol } from './auditoria';
import type { SesionShell } from './sesion';

/**
 * Servicio del panel de administracion — seccion 4.10.8.
 *
 * Compone lo que ya existe: `applyTreeOperation` para el arbol, `wouldExpand` para detectar
 * ampliaciones, `buildNavigationView` para validar paquetes, `resolveEffectiveScope` para la
 * vista de "quien ve que". Aqui no hay logica de gobierno nueva; hay orquestacion, permisos y
 * auditoria.
 */

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

/**
 * Rol de aplicacion mas alto que una persona tiene en CUALQUIERA de sus equipos.
 *
 * Administrar la aplicacion no es un permiso por equipo: quien administra, administra. El ambito
 * de DATOS sigue siendo el de su equipo activo — un Administrador ve los datos que su equipo le
 * permite, igual que cualquier otra persona (4.10.1).
 */
export async function rolMasAltoDe(userId: string): Promise<AppRole> {
  const equipos = await gobierno.listTeams();
  const roles = equipos.flatMap((t) =>
    t.members.filter((m) => m.userId === userId).map((m) => m.role),
  );
  if (roles.includes('administrador')) return 'administrador';
  if (roles.includes('colaborador')) return 'colaborador';
  return 'visor';
}

/**
 * Guardian de todas las rutas del panel.
 *
 * Se invoca al PRINCIPIO de cada pagina de /admin y de cada handler de /api/admin. Ocultar el
 * enlace no protege nada: la seccion 9 pide expresamente que la comprobacion resista
 * "manipulacion directa de solicitudes, no solo ocultamiento de UI".
 */
export async function assertAdmin(sesion: SesionShell): Promise<Actor> {
  const role = await rolMasAltoDe(sesion.userId);
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

export async function esAdministrador(userId: string): Promise<boolean> {
  return await rolMasAltoDe(userId) === 'administrador';
}

// ---------------------------------------------------------------------------
// Arbol (4.1, 4.1.2)
// ---------------------------------------------------------------------------

/**
 * Aplica una operacion sobre la organizacion general y la persiste.
 *
 * `applyTreeOperation` ya comprueba el permiso concreto de la operacion y devuelve los eventos
 * de dominio; aqui solo se persiste el arbol resultante y se traducen esos eventos al log.
 */
export async function ejecutarOperacionDeArbol(actor: Actor, op: TreeOperation): Promise<ManagedTree> {
  const resultado = applyTreeOperation(await gobierno.getTree(), op, actor);

  if (!resultado.ok) {
    if ('denial' in resultado) throw new AdminError(resultado.denial.reason, 403, resultado.denial);
    throw new AdminError(resultado.error, 400);
  }

  await gobierno.setTree(resultado.tree);
  for (const evento of resultado.audit) await registrarEventoDeArbol(evento);
  return resultado.tree;
}

/**
 * Previsualiza el efecto de un movimiento ANTES de confirmarlo.
 *
 * Mover es estructural: si la carpeta de destino tiene otro ambito, todo lo que se mueve lo
 * hereda de inmediato (4.1.2). Que el panel muestre ese cambio antes de aceptar es lo que
 * impide moverlo "solo para ordenar" sin ver que se altera el acceso.
 */
export interface PrevisualizacionDeMovimiento {
  moduleIds: string[];
  scopeAntes?: AccessScope;
  scopeDespues?: AccessScope;
  cambiaElAmbito: boolean;
}

export async function previsualizarMovimiento(
  nodeId: string,
  newParentId: string | null,
): Promise<PrevisualizacionDeMovimiento> {
  const arbol = await gobierno.getTree();
  const nodo = findNode(arbol.nodes, nodeId);
  if (!nodo) throw new AdminError(`El nodo '${nodeId}' no existe.`, 404);

  const padreActual = encontrarPadre(arbol.nodes, nodeId);
  const destino = newParentId === null ? null : findNode(arbol.nodes, newParentId);
  if (newParentId !== null && (!destino || !isFolder(destino))) {
    throw new AdminError(`La carpeta destino '${newParentId}' no existe.`, 404);
  }

  const scopeAntes = padreActual?.scope;
  const scopeDespues = destino && isFolder(destino) ? destino.scope : undefined;

  return {
    moduleIds: collectModuleIds(nodo),
    ...(scopeAntes ? { scopeAntes } : {}),
    ...(scopeDespues ? { scopeDespues } : {}),
    cambiaElAmbito: JSON.stringify(scopeAntes ?? null) !== JSON.stringify(scopeDespues ?? null),
  };
}

/** Carpeta que contiene directamente a un nodo, o undefined si esta en la raiz. */
function encontrarPadre(nodes: NavNode[], nodeId: string): FolderNode | undefined {
  for (const nodo of nodes) {
    if (!isFolder(nodo)) continue;
    if (nodo.children.some((h) => h.id === nodeId)) return nodo;
    const dentro = encontrarPadre(nodo.children, nodeId);
    if (dentro) return dentro;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Ambitos (4.10.3) — aqui vive la puerta de ampliacion
// ---------------------------------------------------------------------------

export interface GuardarAmbitoInput {
  actor: Actor;
  /** Que se esta editando: una carpeta del arbol, o el ambito general de un equipo. */
  destino: { tipo: 'carpeta'; nodeId: string } | { tipo: 'equipo'; teamId: string };
  scope: AccessScope;
  /** Obligatoria si el ambito nuevo AMPLIA respecto del anterior. */
  justificacion?: string;
}

export class ExpansionSinJustificarError extends AdminError {
  constructor(readonly dimensiones: string[]) {
    super(
      `El ambito propuesto AMPLIA el acceso en: ${dimensiones.join(', ')}. Una ampliacion exige ` +
        `una justificacion explicita y queda registrada aparte en el panel de auditoria (4.10.4).`,
      422,
      { dimensiones },
    );
    this.name = 'ExpansionSinJustificarError';
  }
}

/** Dimensiones en las que `propuesto` permite algo que `actual` no permitia. */
export function dimensionesAmpliadas(actual: AccessScope, propuesto: AccessScope): string[] {
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

/**
 * Guarda un ambito, cerrando la puerta que hasta ahora estaba abierta.
 *
 * `wouldExpand` existia y estaba probada desde B.4, pero nunca se invocaba desde un camino de
 * produccion porque no habia superficie de configuracion. Aqui es donde la regla de 4.10.4 —"cada
 * capa solo puede restringir, salvo excepcion marcada explicitamente"— pasa de estar modelada a
 * estar HECHA CUMPLIR.
 */
export async function guardarAmbito(input: GuardarAmbitoInput): Promise<AccessScope> {
  const { actor, destino, scope, justificacion } = input;
  assertCan(actor.role, 'configurar-ambitos');

  const actual = await ambitoActual(destino);
  const amplia = wouldExpand(actual, scope);
  const motivo = justificacion?.trim() ?? '';

  if (amplia && !motivo) {
    throw new ExpansionSinJustificarError(dimensionesAmpliadas(actual, scope));
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

  await aplicarAmbito(destino, guardado);

  await registrarCambio({
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

async function ambitoActual(destino: GuardarAmbitoInput['destino']): Promise<AccessScope> {
  if (destino.tipo === 'equipo') {
    return (await gobierno.getTeam(destino.teamId))?.defaultScope ?? { restrictions: [] };
  }
  const nodo = findNode((await gobierno.getTree()).nodes, destino.nodeId);
  if (!nodo || !isFolder(nodo)) throw new AdminError(`La carpeta '${destino.nodeId}' no existe.`, 404);
  return nodo.scope ?? { restrictions: [] };
}

async function aplicarAmbito(destino: GuardarAmbitoInput['destino'], scope: AccessScope): Promise<void> {
  if (destino.tipo === 'equipo') {
    const equipo = await gobierno.getTeam(destino.teamId);
    if (!equipo) throw new AdminError(`El equipo '${destino.teamId}' no existe.`, 404);
    await gobierno.upsertTeam({ ...equipo, defaultScope: scope });
    return;
  }

  const arbol = await gobierno.getTree();
  const nodo = findNode(arbol.nodes, destino.nodeId);
  if (!nodo || !isFolder(nodo)) throw new AdminError(`La carpeta '${destino.nodeId}' no existe.`, 404);
  nodo.scope = scope;
  await gobierno.setTree(arbol);
}

// ---------------------------------------------------------------------------
// Validacion de dimensiones contra el esquema real (4.10.8)
// ---------------------------------------------------------------------------

/**
 * Esquema de la fuente activa, leido del CACHE.
 *
 * El documento pide validacion en vivo contra `getSchema()`, pero el principio 2 prohibe que el
 * proceso web invoque el conector. El job deja el `SchemaDescriptor` en el cache justamente para
 * esto (6.4): el panel valida contra el esquema real sin abrir un camino a la fuente.
 */
export async function esquemaActivo(): Promise<SchemaDescriptor | null> {
  try {
    return (await cacheL2.get<SchemaDescriptor>(SCHEMA_CACHE_KEY))?.value ?? null;
  } catch {
    return null;
  }
}

/** Dimensiones seleccionables en el editor de ambitos. Nunca texto libre. */
export async function dimensionesDisponibles(): Promise<
  { table: string; field: string; key: string }[]
> {
  const schema = await esquemaActivo();
  if (!schema) return [];
  return schema.tables.flatMap((tabla) =>
    tabla.fields
      .filter((campo) => !campo.isMeasure)
      .map((campo) => ({
        table: tabla.name,
        field: campo.name,
        key: `${tabla.name}.${campo.name}`,
      })),
  );
}

/** Rechaza un ambito que referencie dimensiones que no existen en el esquema activo. */
export async function validarDimensiones(scope: AccessScope): Promise<string[]> {
  const disponibles = new Set((await dimensionesDisponibles()).map((d) => d.key));
  if (disponibles.size === 0) return [];
  return scope.restrictions
    .map((r) => dimensionKey(r.dimension))
    .filter((clave) => !disponibles.has(clave));
}

// ---------------------------------------------------------------------------
// Equipos, membresia y paquetes (4.10.2, 4.1.3)
// ---------------------------------------------------------------------------

export async function guardarEquipo(actor: Actor, equipo: Team): Promise<Team> {
  assertCan(actor.role, 'gestionar-equipos');
  const anterior = await gobierno.getTeam(equipo.id);
  await gobierno.upsertTeam(equipo);

  await registrarCambio({
    actorId: actor.userId,
    entityType: 'team',
    entityId: equipo.id,
    action: anterior ? 'update' : 'create',
    ...(anterior ? { before: anterior } : {}),
    after: equipo,
  });

  return equipo;
}

export async function cambiarMembresia(
  actor: Actor,
  teamId: string,
  userId: string,
  role: AppRole | null,
): Promise<Team> {
  assertCan(actor.role, 'gestionar-usuarios-y-roles');
  const equipo = await gobierno.getTeam(teamId);
  if (!equipo) throw new AdminError(`El equipo '${teamId}' no existe.`, 404);

  const antes = { ...equipo };
  const sinPersona = equipo.members.filter((m) => m.userId !== userId);
  const actualizado: Team = {
    ...equipo,
    members: role === null ? sinPersona : [...sinPersona, { userId, role }],
  };

  await gobierno.upsertTeam(actualizado);
  await registrarCambio({
    actorId: actor.userId,
    entityType: 'membership',
    entityId: `${teamId}/${userId}`,
    action: role === null ? 'delete' : 'update',
    before: antes.members,
    after: actualizado.members,
  });

  return actualizado;
}

export interface ValidacionDePaquete {
  pkg: ModulePackage;
  /** Nodos que el paquete referencia pero la audiencia destino no tiene concedidos. */
  noMostrables: { teamId: string; moduleId: string; reason: string }[];
}

/**
 * Guarda un paquete y comprueba, contra CADA equipo que lo usa, que no cuela accesos.
 *
 * El documento pide validacion automatica al construir el paquete (4.10.6). No se rechaza el
 * guardado —un paquete puede crearse antes de asignarlo— pero se devuelve lo que no seria
 * mostrable, para que el Administrador lo vea explicitamente en vez de descubrirlo despues.
 */
export async function guardarPaquete(actor: Actor, pkg: ModulePackage): Promise<ValidacionDePaquete> {
  assertCan(actor.role, 'gestionar-paquetes-visuales');
  const anterior = await gobierno.getPackage(pkg.id);
  await gobierno.upsertPackage(pkg);

  const generalTree = await getGeneralTree();
  const noMostrables: ValidacionDePaquete['noMostrables'] = [];

  for (const equipo of await gobierno.listTeams()) {
    if (equipo.assignedPackageId !== pkg.id) continue;
    const vista = buildNavigationView({ generalTree, team: equipo, pkg });
    for (const colgante of vista.dangling) {
      noMostrables.push({
        teamId: equipo.id,
        moduleId: colgante.moduleId,
        reason: colgante.reason,
      });
    }
  }

  await registrarCambio({
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

export interface QuienVeQue {
  userId: string;
  teamId: string;
  moduleId: string;
  /** true si el equipo tiene el modulo concedido. Sin esto, el ambito es irrelevante. */
  tieneAcceso: boolean;
  scope: AccessScope;
  /** Traza legible: que capa aplico que, y desde que carpeta. */
  pasos: { capa: string; origen: string; amplio: boolean; resultado: AccessScope }[];
  usoAmpliacion: boolean;
  noVeNada: boolean;
  existeEnElArbol: boolean;
}

/**
 * Resuelve "quien ve que" para un usuario y un modulo.
 *
 * Es casi gratis: `resolveEffectiveScope` ya devuelve `steps` con la capa, su origen y el ambito
 * acumulado. Se construyo en B.4 exactamente para esta vista y hasta ahora nadie lo consumia.
 */
export async function quienVeQue(userId: string, teamId: string, moduleId: string): Promise<QuienVeQue> {
  const equipo = await gobierno.getTeam(teamId);
  if (!equipo) throw new AdminError(`El equipo '${teamId}' no existe.`, 404);

  const usuario = await gobierno.getUser(userId) ?? { userId };
  const generalTree = await getGeneralTree();
  const resolucion = resolveEffectiveScope({
    user: usuario,
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
      origen: s.source,
      amplio: s.expanded,
      resultado: s.result,
    })),
    usoAmpliacion: resolucion.usedAuthorizedExpansion,
    noVeNada: resolucion.deniesEverything,
    existeEnElArbol: resolucion.moduleExistsInGeneralTree,
  };
}
