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
export {
  ACENTOS,
  MAX_DECIMALES,
  MAX_SUBTITULO,
  MAX_UNIDAD,
  MODOS_DE_LEYENDA,
  PRESENTACION_MINIMA,
  formateadorDe,
  validarPresentacion,
  type AcentoDeObjeto,
  type ClaveDePresentacion,
  type FormatoNumerico,
  type ModoDeLeyenda,
  type PresentacionDeObjeto,
  type ProblemaDePresentacion,
} from './presentacion/contrato';
export {
  aFieldRef,
  bindingDesdeRanuras,
  cabeEnRanura,
  campoDeRanura,
  conCampoEnRanura,
  ranurasDe,
  ranurasDelContrato,
  ranurasPorDefecto,
  sinCampoEnRanura,
  validarRanuras,
  type AsignacionDeRanuras,
  type PozoDeCampos,
  type ProblemaDeRanura,
  type RanuraDeCampos,
} from './presentacion/pozos';
export {
  MAX_DIMENSIONES_DEL_PANEL,
  SELECTORES_DE_FECHA,
  TIPOS_DE_SELECTOR,
  esTipoDeFecha,
  selectorPorDefecto,
  selectoresEfectivos,
  validarPanelDeFiltros,
  type ConfiguracionDePanelDeFiltros,
  type ProblemaDeSelector,
  type SelectorDeDimension,
  type SelectorEfectivo,
  type TipoDeSelector,
} from './presentacion/panelDeFiltros';
export {
  ICONOS_DE_OBJETO,
  NOMBRES_DE_ICONO,
  TRAZOS_DE_ICONO,
  esNombreDeIcono,
  type NombreDeIcono,
} from './presentacion/iconos';
export {
  AGREGACION_POR_DEFECTO,
  ETIQUETA_DE_AGREGACION,
  acumular,
  agregacionesDe,
  agregacionesPara,
  cerrar,
  nuevoAcumulador,
  validarAgregacion,
  type Acumulador,
  type ProblemaDeAgregacion,
} from './registry/agregacion';
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
  ConfiguracionDeObjeto,
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
export {
  UMBRAL_DE_ELEMENTOS,
  elementosDe,
  opcionesDe,
  opcionesDeBarras,
  opcionesDeLineas,
  type OpcionesDeGrafico,
  type PaletaDeGrafico,
  type TipoDeGrafico,
} from './graficos/opciones';
