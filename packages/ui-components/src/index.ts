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
export {
  attachmentOf,
  validateAttachments,
  type BuscarDefinicion,
} from './registry/attachments';
export { catalogoInicial } from './registry/catalog';
export { desgloseDe, proyectarObjeto } from './registry/proyeccion';
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
  AttachedObjectInstance,
  AttachmentScope,
  DeprecationNotice,
  ObjectCategory,
  ObjectCertification,
  ObjectDataContract,
  ObjectInstance,
  ObjectVersion,
  TablePopupAttachment,
  TooltipAttachment,
  VisualObjectDefinition,
} from './registry/types';
export {
  aggregateBy,
  fieldKey,
  toCategorical,
  toKpi,
  toMatrix,
  toSlicerOptions,
  validateBinding,
  type AggregatedRow,
  type AggregatedRows,
  type BindingProblem,
  type CategoricalViewModel,
  type CategoryPoint,
  type KpiViewModel,
  type MatrixViewModel,
} from './registry/viewModel';
