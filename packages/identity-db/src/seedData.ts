import type {
  AccessScopeRow,
  NavNodeRow,
  ScopeRestrictionRow,
  TeamGrantedNodeRow,
  TeamMembershipRow,
  TeamModuleScopeRow,
  TeamRow,
  UserRow,
  UserScopeRow,
} from './rows';

/** Datos de arranque del entorno de staging. */

export const seedScopes: AccessScopeRow[] = [
  { id: 'sc-regional', expansionId: null },
  { id: 'sc-norte', expansionId: null },
  { id: 'sc-este', expansionId: null },
  { id: 'sc-penal-civil', expansionId: null },
];

const restriccion = (
  scopeId: string,
  dimField: string,
  valores: string[],
): ScopeRestrictionRow => ({
  scopeId,
  dimTable: 'DimTribunal',
  dimField,
  allowedValues: JSON.stringify(valores),
});

export const seedRestrictions: ScopeRestrictionRow[] = [
  restriccion('sc-regional', 'Distrito', ['Distrito Norte', 'Distrito Este', 'Distrito Sur']),
  restriccion('sc-norte', 'Distrito', ['Distrito Norte']),
  restriccion('sc-este', 'Distrito', ['Distrito Este']),
  restriccion('sc-penal-civil', 'Materia', ['Penal', 'Civil']),
];

const carpeta = (
  id: string,
  name: string,
  parentId: string | null,
  orderIndex: number,
  scopeId: string | null,
): NavNodeRow => ({
  id,
  type: 'folder',
  name,
  icon: null,
  parentId,
  orderIndex,
  moduleId: null,
  slug: null,
  deletedAt: null,
  scopeId,
});

const modulo = (
  id: string,
  name: string,
  moduleId: string,
  slug: string,
  parentId: string,
  orderIndex: number,
): NavNodeRow => ({
  id,
  type: 'module',
  name,
  icon: null,
  parentId,
  orderIndex,
  moduleId,
  slug,
  deletedAt: null,
  scopeId: null,
});

/**
 * Organizacion general de arranque, con tres niveles de anidamiento para poder comprobar la
 * herencia de ambito a profundidad (criterio de aceptacion de la seccion 9).
 */
export const seedNavNodes: NavNodeRow[] = [
  carpeta('nodo-institucional', 'Institucional', null, 0, null),
  carpeta('nodo-regional', 'Regional', 'nodo-institucional', 0, 'sc-regional'),
  carpeta('nodo-norte', 'Distrito Norte', 'nodo-regional', 0, 'sc-norte'),
  carpeta('nodo-este', 'Distrito Este', 'nodo-regional', 1, 'sc-este'),
  modulo('nodo-m-casos-norte', 'Casos pendientes', 'casos-pendientes', 'casos-pendientes', 'nodo-norte', 0),
  modulo('nodo-m-audiencias', 'Audiencias', 'audiencias', 'audiencias', 'nodo-norte', 1),
  // Modulo de muestra de los objetos que no leen datos. Vive dentro de lo concedido al equipo
  // Norte para que se pueda abrir sin tocar permisos: ensenar un catalogo al que nadie llega es
  // la forma mas facil de que nadie sepa que existe.
  modulo('nodo-m-composicion', 'Composicion', 'composicion', 'composicion', 'nodo-norte', 2),
  modulo('nodo-m-casos-este', 'Casos pendientes Este', 'casos-este', 'casos-este', 'nodo-este', 0),
  modulo('nodo-m-nacional', 'Estadisticas nacionales', 'estadisticas', 'estadisticas', 'nodo-institucional', 1),
];

/**
 * Dos equipos con ambitos distintos:
 *  - Norte: toda la carpeta Regional, restringido ademas a materias Penal y Civil.
 *  - Este: solo la carpeta del Distrito Este, sin restriccion de materia.
 */
export const seedTeams: TeamRow[] = [
  { id: 'equipo-norte', name: 'Equipo Distrito Norte', defaultScopeId: 'sc-penal-civil', assignedPackageId: null },
  { id: 'equipo-este', name: 'Equipo Distrito Este', defaultScopeId: null, assignedPackageId: null },
];

export const seedGrantedNodes: TeamGrantedNodeRow[] = [
  { teamId: 'equipo-norte', nodeId: 'nodo-regional' },
  { teamId: 'equipo-este', nodeId: 'nodo-este' },
];

export const seedUsers: UserRow[] = [
  { id: 'u-ana', combineTeamsByUnion: false },
  { id: 'u-beto', combineTeamsByUnion: false },
  { id: 'u-admin', combineTeamsByUnion: false },
  // Existe en el directorio y no pertenece a NINGUN equipo. Es un caso real —alguien dado de
  // alta antes de asignarle equipo— y es la cuenta contra la que se prueba el bloqueo por
  // intentos fallidos sin dejar bloqueada a nadie que las demas pruebas necesiten.
  { id: 'u-sin-equipo', combineTeamsByUnion: false },
];

export const seedMemberships: TeamMembershipRow[] = [
  { teamId: 'equipo-norte', userId: 'u-ana', role: 'colaborador' },
  { teamId: 'equipo-norte', userId: 'u-admin', role: 'administrador' },
  { teamId: 'equipo-este', userId: 'u-beto', role: 'visor' },
  // Ana pertenece a los dos equipos: sirve para comprobar que el ambito depende del equipo
  // ACTIVO y no de la union implicita de todos sus equipos (4.10.2).
  { teamId: 'equipo-este', userId: 'u-ana', role: 'visor' },
];

export const seedModuleScopes: TeamModuleScopeRow[] = [];
export const seedUserScopes: UserScopeRow[] = [];
