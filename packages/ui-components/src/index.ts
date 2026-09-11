/**
 * Repositorio de objetos visuales versionados — secciones 4.2 y 4.5.
 *
 * Cada objeto se publica con version MAYOR.MENOR.PARCHE y cada instancia insertada en un modulo
 * FIJA la version exacta que usa. Publicar una version nueva no altera instancias ya desplegadas.
 *
 * Los objetos se enlazan UNICAMENTE contra un datasetId del registro: reciben filas ya leidas
 * del cache y ya filtradas por el ambito de quien mira. Ningun objeto conoce la fuente, la
 * consulta ni el conector activo.
 */
export { ObjectRegistry, ObjectRegistryError, type DeprecationWarning, type PublishInput } from './registry/ObjectRegistry';
export { catalogoInicial } from './registry/catalog';
export {
  classifyBump,
  compareVersions,
  formatVersion,
  isValidVersion,
  maxVersion,
  parseVersion,
  type Semver,
  type VersionBump,
} from './registry/semver';
export type {
  DeprecationNotice,
  ObjectCategory,
  ObjectCertification,
  ObjectDataContract,
  ObjectInstance,
  ObjectVersion,
  VisualObjectDefinition,
} from './registry/types';
export {
  fieldKey,
  toCategorical,
  toKpi,
  toMatrix,
  toSlicerOptions,
  validateBinding,
  type BindingProblem,
  type CategoricalViewModel,
  type CategoryPoint,
  type KpiViewModel,
  type MatrixViewModel,
} from './registry/viewModel';
