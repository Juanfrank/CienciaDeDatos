/** Almacen de identidad y gobierno — secciones 4.7.2 y 4.10.7. */
export {
  buildNavTree,
  buildPackageTree,
  buildScopeLookup,
  parseAllowedValues,
  serializeAllowedValues,
  toAccessScope,
  toAppRole,
  toGovernedUser,
  toTeam,
  type ScopeLookup,
} from './mappers';
export type * from './rows';

/** Datos de arranque de staging (seccion 8.1). */
export {
  seedGrantedNodes,
  seedMemberships,
  seedModuleScopes,
  seedNavNodes,
  seedRestrictions,
  seedScopes,
  seedTeams,
  seedUserScopes,
  seedUsers,
} from './seedData';
