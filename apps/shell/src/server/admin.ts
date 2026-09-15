import type { SchemaDescriptor } from '@app/data-contracts';
import { modules } from './moduleStore';
import { getManagedTree } from './context';
import { expansionsCount } from './audit';
import {
  can,
  type AccessScope,
  type AppRole,
  type Actor,
  type FolderNode,
  type GovernedUser,
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
  isMember,
  resolveEffectiveScope,
  wouldExpand,
  wouldLeaveNoAdministrator,
} from '@app/access-control';
import { SCHEMA_CACHE_KEY } from '@app/caching';
import { cacheL2, getGeneralTree } from './context';
import { governance } from './governance';
import { AZURE_AD_AVAILABLE, localesAccounts } from './identity';
import { changeRecord, treeEventRecord } from './audit';
import { redirect } from 'next/navigation';
import type { ShellSession } from './session';
import { pageSessionRequire } from './session';

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

/**
 * Guardian de UNA PAGINA del panel, puesto en la pagina y no solo en el layout.
 *
 * El layout guardaba las veintinueve, y eso es un unico punto del que todas dependen sin decirlo:
 * ninguna pagina declaraba quien puede verla, asi que abrir el layout un poco —para que quien crea
 * borradores llegue a la tabla de modulos— habria abierto de golpe equipos, ambitos y auditoria.
 * Con el guardian en cada pagina, abrir una no abre las demas.
 *
 * Redirige en vez de lanzar porque esto es una PAGINA: quien llega sin permiso se lleva una
 * pantalla que lo explica. Lo que responde 403 es la API, que es la que importa cuando alguien se
 * salta la interfaz.
 */
export async function paginaDeAdmin(): Promise<Actor> {
  const sesion = await pageSessionRequire();
  const role = await roleMoreHeightOf(sesion.userId);
  if (!can(role, 'ver-panel-auditoria')) redirect('/admin-without-permission');
  return { userId: sesion.userId, role };
}

/**
 * Guardian de la tabla de modulos, que admite a quien puede CREAR BORRADORES.
 *
 * Es la unica seccion del panel que no es de gobierno: crear un modulo y editarlo es lo que hace
 * un Colaborador, y desde que el editor dejo de tener entrada propia en el menu de usuario, esta
 * es su puerta. Lo que ve cada quien lo decide la propia tabla, fila a fila; esto solo dice quien
 * puede abrirla.
 */
export async function paginaDeModulos(): Promise<Actor> {
  const sesion = await pageSessionRequire();
  const role = await roleMoreHeightOf(sesion.userId);
  if (!can(role, 'ver-panel-auditoria') && !can(role, 'crear-editar-modulos-borrador')) {
    redirect('/admin-without-permission');
  }
  return { userId: sesion.userId, role };
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

/** Lo que impide a un Administrador entrar por su cuenta local. */
export type ImpedimentoDeAcceso = 'sin-cuenta' | 'bloqueada' | 'sin-segundo-factor';

export interface AccesoDeAdministrador {
  userId: string;
  /** Ausente cuando puede entrar sin depender de que Azure AD responda. */
  impedimento?: ImpedimentoDeAcceso;
}

export interface AccesoDeQuienesAdministran {
  quienes: AccesoDeAdministrador[];
  /** Cuantos pueden entrar por cuenta local ahora mismo. */
  conAccesoPropio: number;
  /** Si hay federacion configurada en este despliegue. */
  federacion: boolean;
  gravedad: 'ok' | 'atencion' | 'grave';
}

/**
 * Si quienes administran pueden ademas AUTENTICARSE — apartado 2.8 de la hoja de ruta.
 *
 * `wouldLeaveNoAdministrator` comprueba el gobierno: que alguien conserva el rol. No comprueba que
 * esa persona pueda entrar, y una cuenta bloqueada satisface la invariante mientras la institucion
 * sigue de hecho sin acceso. Cruzar las dos cosas es lo que falta, y por eso vive AQUI y no en
 * `access-control`: ese paquete es `type:lib` y no sabe nada de credenciales, a proposito.
 *
 * Es un AVISO y no un bloqueo. Lo unico que se puede comprobar desde dentro es la cuenta local; si
 * alguien entra por Azure AD, que su identidad siga activa lo sabe Azure y no esta aplicacion.
 * Bloquear un cambio sobre una comprobacion que solo ve la mitad del cuadro dejaria a quien
 * administra sin poder reorganizar nada por una cuenta que quiza si funciona.
 *
 * Lo que SI se ve entero es el caso 2 del procedimiento de acceso de emergencia: que Azure AD deje
 * de responder y ninguna de las personas que administran tenga cuenta local. Ese es el aviso.
 */
export async function accesoDeQuienesAdministran(): Promise<AccesoDeQuienesAdministran> {
  const [nombres, cuentas] = await Promise.all([administradores(), localesAccounts()]);
  const porUsuario = new Map(cuentas.map((c) => [c.userId, c]));

  const quienes = nombres.map((userId): AccesoDeAdministrador => {
    const cuenta = porUsuario.get(userId);
    if (!cuenta) return { userId, impedimento: 'sin-cuenta' };
    if (cuenta.bloqueada) return { userId, impedimento: 'bloqueada' };
    // Una cuenta local sin TOTP no es utilizable: 4.7.2 lo exige, y el inicio de sesion lo pide.
    if (!cuenta.tieneSegundoFactor) return { userId, impedimento: 'sin-segundo-factor' };
    return { userId };
  });

  const conAccesoPropio = quienes.filter((q) => q.impedimento === undefined).length;

  return {
    quienes,
    conAccesoPropio,
    federacion: AZURE_AD_AVAILABLE,
    gravedad:
      conAccesoPropio > 0 ? 'ok' : AZURE_AD_AVAILABLE ? 'atencion' : 'grave',
  };
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
export async function indicadoresDeAdmin(): Promise<{
  ampliaciones: number;
  papelera: number;
  borradores: number;
}> {
  const [ampliaciones, arbol, definiciones] = await Promise.all([
    expansionsCount(),
    getManagedTree(),
    modules.list(),
  ]);
  return {
    ampliaciones,
    papelera: arbol.trash.length,
    // Lo que espera una decision de alguien: un borrador propuesto y sin aprobar.
    borradores: definiciones.filter((m) => m.status === 'pendiente-de-aprobacion').length,
  };
}

// ---------------------------------------------------------------------------
// Quien ve un modulo, visto DESDE el modulo (4.10.6 y 4.10.8)
// ---------------------------------------------------------------------------

export interface AccesoDeEquipo {
  teamId: string;
  nombre: string;
  /** Concedido directamente sobre el nodo del modulo: se puede revocar desde aqui. */
  directo: boolean;
  /** Concedido porque el equipo tiene una carpeta ANCESTRO: se revoca alli, no aqui. */
  heredadoDe: string | null;
  /** Si de hecho lo alcanza, contando lo oculto. */
  alcanza: boolean;
  /** Personas del equipo, que son las que lo ven a traves de el. */
  miembros: { userId: string; nombre: string; role: AppRole }[];
}

/** Una persona que alcanza el modulo, y por que camino. */
export interface AccesoDePersona {
  userId: string;
  nombre: string;
  /** Concedido a su nombre sobre el nodo del modulo: se revoca desde aqui. */
  directo: boolean;
  /** Concedido a su nombre sobre una carpeta ANCESTRO: se revoca alli. */
  heredadoDe: string | null;
  /** Equipos suyos que tambien lo alcanzan. Si los hay, quitarle lo individual no la deja fuera. */
  porEquipo: string[];
}

export interface AccesoAlModulo {
  moduleId: string;
  /** El nodo del modulo en la organizacion general. Sin el no hay nada que conceder. */
  nodeId: string | null;
  equipos: AccesoDeEquipo[];
  /** Quien lo alcanza a titulo individual, o por un equipo, con el camino de cada cual. */
  personas: AccesoDePersona[];
}

/**
 * Quien alcanza un modulo y por que — visto desde el propio modulo.
 *
 * Es la misma informacion que ya se concede desde el equipo, leida por el otro extremo. Hace
 * falta porque las dos preguntas se hacen desde sitios distintos: «que ve este equipo» al dar de
 * alta a alguien, y «quien ve esto» al publicar un tablero con datos sensibles. Sin la segunda,
 * responderla obliga a abrir los equipos uno por uno.
 *
 * Distingue lo DIRECTO de lo HEREDADO a proposito: revocar lo heredado desde aqui no se puede
 * —habria que quitarle al equipo la carpeta entera, que es otra decision y afecta a mas cosas—, y
 * un boton que lo intentara dejaria a quien lo pulsa creyendo que lo hizo.
 */
export async function accessToModule(moduleId: string): Promise<AccesoAlModulo> {
  const [generalTree, equipos, usuarios] = await Promise.all([
    getGeneralTree(),
    governance.listTeams(),
    governance.listUsers(),
  ]);

  /** Ruta de nodos desde la raiz hasta el modulo, el ultimo incluido. */
  const ruta = (nodos: NavNode[]): NavNode[] | null => {
    for (const nodo of nodos) {
      if (!isFolder(nodo)) {
        if (nodo.moduleRef.moduleId === moduleId) return [nodo];
        continue;
      }
      const sub = ruta(nodo.children);
      if (sub) return [nodo, ...sub];
    }
    return null;
  };

  const camino = ruta(generalTree);
  const nodeId = camino ? (camino[camino.length - 1]?.id ?? null) : null;
  const ancestros = camino ? camino.slice(0, -1) : [];

  /*
   * Las personas se listan una sola vez, con TODOS sus caminos.
   *
   * Listar «los concedidos individualmente» por un lado y «los de los equipos» por otro dejaria a
   * quien tiene las dos cosas apareciendo dos veces, y la × de una de las filas pareceria que le
   * quita el acceso cuando no se lo quita.
   */
  const personas = usuarios
    .map((usuario) => {
      const suyos = new Set(usuario.grantedNodes ?? []);
      const ancestro = ancestros.find((a) => suyos.has(a.id));
      return {
        userId: usuario.userId,
        nombre: usuario.displayName ?? usuario.userId,
        directo: nodeId !== null && suyos.has(nodeId),
        heredadoDe: ancestro ? (ancestro as FolderNode).name : null,
        porEquipo: equipos
          .filter((e) => isMember(e, usuario.userId) && canTeamAccessModule(generalTree, e, moduleId))
          .map((e) => e.name),
      };
    })
    .filter((p) => p.directo || p.heredadoDe !== null || p.porEquipo.length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    moduleId,
    nodeId,
    personas,
    equipos: equipos
      .map((equipo) => {
        const ancestro = ancestros.find((a) => equipo.grantedNodes.includes(a.id));
        return {
          teamId: equipo.id,
          nombre: equipo.name,
          directo: nodeId !== null && equipo.grantedNodes.includes(nodeId),
          heredadoDe: ancestro ? (ancestro as FolderNode).name : null,
          alcanza: canTeamAccessModule(generalTree, equipo, moduleId),
          miembros: equipo.members.map((m) => ({
            userId: m.userId,
            nombre: usuarios.find((u) => u.userId === m.userId)?.displayName ?? m.userId,
            role: m.role,
          })),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}

/**
 * Concede o revoca un modulo a un equipo, desde el modulo.
 *
 * Escribe por el MISMO sitio que la pantalla del equipo —`saveTeam`, con su auditoria— en vez de
 * tocar `grantedNodes` por su cuenta: dos caminos para conceder acabarian con dos reglas para
 * conceder.
 */
export async function grantModuleToTeam(
  actor: Actor,
  input: { moduleId: string; teamId: string; conceder: boolean },
): Promise<Team> {
  const { nodeId } = await accessToModule(input.moduleId);
  if (!nodeId) {
    throw new AdminError(
      'Ese modulo todavia no esta en la organizacion general, asi que no hay nodo que conceder.',
      409,
    );
  }

  const equipo = await governance.getTeam(input.teamId);
  if (!equipo) throw new AdminError(`El equipo '${input.teamId}' no existe.`, 404);

  const concedidos = new Set(equipo.grantedNodes);
  if (input.conceder) concedidos.add(nodeId);
  else concedidos.delete(nodeId);

  return await saveTeam(actor, { ...equipo, grantedNodes: [...concedidos] });
}

/**
 * Concede o revoca un modulo a UNA PERSONA, a su nombre.
 *
 * Antes este boton metia a la persona en un equipo que ya tenia el modulo. Concedia, si, pero de
 * paso le daba todo lo demas que tuviera ese equipo, y el registro decia «cambio de membresia»
 * donde lo que habia pasado era «le dieron este modulo». Ahora la concesion individual existe en
 * el modelo (`GovernedUser.grantedNodes`) y la resolucion de navegacion la mira, asi que esto
 * concede exactamente lo que dice y nada mas.
 *
 * Se audita como `user-grant` y no como `team`: leer el registro de un equipo no puede contar
 * quien mas alcanza sus modulos, y el que concede a una persona tiene que constar por si mismo.
 */
export async function grantModuleToUser(
  actor: Actor,
  input: { moduleId: string; userId: string; conceder: boolean },
): Promise<GovernedUser> {
  assertCan(actor.role, 'gestionar-usuarios-y-roles');

  const { nodeId } = await accessToModule(input.moduleId);
  if (!nodeId) {
    throw new AdminError(
      'Ese modulo todavia no esta en la organizacion general, asi que no hay nodo que conceder.',
      409,
    );
  }

  const usuario = await governance.getUser(input.userId);
  if (!usuario) throw new AdminError(`La persona '${input.userId}' no existe.`, 404);

  const concedidos = new Set(usuario.grantedNodes ?? []);
  if (input.conceder) concedidos.add(nodeId);
  else concedidos.delete(nodeId);

  const actualizado: GovernedUser = { ...usuario, grantedNodes: [...concedidos] };
  await governance.upsertUser(actualizado);

  await changeRecord({
    actorId: actor.userId,
    entityType: 'user-grant',
    entityId: `${input.userId}/${nodeId}`,
    action: input.conceder ? 'update' : 'delete',
    before: usuario.grantedNodes ?? [],
    after: actualizado.grantedNodes,
  });

  return actualizado;
}
