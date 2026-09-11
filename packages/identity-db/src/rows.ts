/**
 * Formas de fila del almacen de identidad y gobierno.
 *
 * Se declaran a mano, reflejando `prisma/schema.prisma`, en vez de depender de los tipos
 * generados por Prisma. El motivo es de capas: los mapeadores de este paquete son funciones
 * PURAS y deben poder probarse sin cliente de base de datos ni motor de consulta. La capa de
 * repositorio, que si usa el cliente de Prisma, es delgada y se limita a leer filas con esta
 * forma y pasarlas por estos mapeadores.
 *
 * Consecuencia a vigilar: un cambio en schema.prisma que no se refleje aqui no lo detecta el
 * compilador. Por eso `mappers.spec.ts` incluye una prueba de coherencia entre ambos.
 */

export interface AccessScopeRow {
  id: string;
  expansionId: string | null;
}

export interface ScopeRestrictionRow {
  scopeId: string;
  dimTable: string;
  dimField: string;
  /** Serializado: SQL Server no tiene tipo array nativo. */
  allowedValues: string;
}

export interface ScopeExpansionRow {
  id: string;
  justification: string;
  authorizedBy: string;
  authorizedAt: Date;
  revokedAt: Date | null;
}

export interface NavNodeRow {
  id: string;
  type: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  orderIndex: number;
  moduleId: string | null;
  slug: string | null;
  deletedAt: Date | null;
  scopeId: string | null;
}

export interface TeamRow {
  id: string;
  name: string;
  defaultScopeId: string | null;
  assignedPackageId: string | null;
}

export interface TeamGrantedNodeRow {
  teamId: string;
  nodeId: string;
}

export interface TeamMembershipRow {
  teamId: string;
  userId: string;
  role: string;
}

export interface TeamModuleScopeRow {
  teamId: string;
  moduleId: string;
  scopeId: string;
}

export interface UserScopeRow {
  userId: string;
  /** Cadena vacia para el ambito personal general; el moduleId para un override por modulo. */
  moduleId: string;
  scopeId: string;
}

export interface UserRow {
  id: string;
  combineTeamsByUnion: boolean;
}

export interface PackageNodeRow {
  id: string;
  packageId: string;
  type: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  orderIndex: number;
  moduleId: string | null;
}

export interface ModulePackageRow {
  id: string;
  name: string;
}
