/** Formas de fila del almacen de identidad y gobierno. */

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
  displayName?: string;
  mail?: string;
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
