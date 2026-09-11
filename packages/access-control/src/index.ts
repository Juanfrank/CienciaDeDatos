/**
 * Organizacion general, equipos y ambitos de acceso (RLS de negocio).
 *
 * Implementa las secciones 4.1.1, 4.1.3, 4.10.2, 4.10.3, 4.10.4 y 4.10.6 del contrato de
 * ingenieria. Es un paquete de LOGICA PURA: define el modelo y lo resuelve, pero no lo
 * persiste ni lo lee de ningun sitio. La persistencia vive en la base de identidad (4.10.7)
 * y quien la orquesta es el backend.
 *
 * La pieza central es `resolveEffectiveScope`, que decide que subconjunto de datos ve cada
 * persona. Se mantiene pura precisamente para poder probarla de forma exhaustiva.
 */
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
  accessibleModuleIds,
  buildNavigationView,
  canTeamAccessModule,
  findDanglingGrants,
  foldersWithScope,
  type BuildNavigationViewInput,
  type NavigationView,
} from './navigation';

export {
  resolveEffectiveScope,
  type EffectiveScopeResolution,
  type ResolveEffectiveScopeInput,
  type ScopeResolutionStep,
} from './resolveEffectiveScope';

/**
 * Fixtures del modelo de gobierno, para pruebas.
 *
 * Viven con el dominio que describen: ponerlos en un paquete aparte que importe este creaba
 * una dependencia circular. Son datos puros, asi que no lastran el bundle de produccion.
 */
export * as gobiernoFixtures from './__fixtures__/gobierno';
