/** Organizacion general, equipos y ambitos de acceso (RLS de negocio). */
export {
  UNRESTRICTED_SCOPE,
  applyLayer,
  assertScopeIsEnforceable,
  deniesEverything,
  dimensionKey,
  filterResultByScope,
  intersect,
  intersectRequestedFilters,
  scopeToFilters,
  scopeToSecurityContext,
  withScopeFilters,
  wouldExpand,
  type AccessScope,
  type AuthorizedExpansion,
  type ScopeRestriction,
} from './AccessScope';

export {
  collectModuleIds,
  collectScopedDimensions,
  findModulePath,
  findNode,
  isFolder,
  isModule,
  maxDepth,
  type FolderNode,
  type ModuleLeaf,
  type ModuleRef,
  type NavNode,
} from './NavigationTree';

export {
  APP_ROLES,
  isMember,
  roleInTeam,
  type AppRole,
  type GovernedUser,
  type Team,
  type TeamMember,
} from './Team';

export type { DanglingPackageNode, ModulePackage } from './ModulePackage';

export {
  PermissionError,
  assertCan,
  can,
  capabilitiesOf,
  denial,
  type Capability,
  type PermissionDenial,
} from './permissions';

export {
  accessibleModuleIds,
  buildNavigationView,
  canTeamAccessModule,
  findDanglingGrants,
  foldersWithScope,
  type BuildNavigationViewInput,
  type NavigationView,
} from './navigation';

export {
  applyTreeOperation,
  depthWarning,
  trashedModules,
  type Actor,
  type ManagedTree,
  type TrashedNode,
  type TreeAuditEvent,
  type TreeOperation,
  type TreeOperationResult,
} from './treeOperations';

export {
  resolveEffectiveScope,
  type EffectiveScopeResolution,
  type ResolveEffectiveScopeInput,
  type ScopeResolutionStep,
} from './resolveEffectiveScope';

/** Fixtures del modelo de gobierno, para pruebas. */
export * as gobiernoFixtures from './__fixtures__/governance';
export {
  administratorsOf,
  wouldLeaveNoAdministrator,
  type LastAdministratorDenial,
} from './lastAdministrator';
