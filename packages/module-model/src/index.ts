/** Definicion de modulo — secciones 4.1, 4.2 y 4.6. */
export {
  datasetsConsumedBy,
  findPage,
  instancesOf,
  moduleUrl,
  type GridItem,
  type ModuleDefinition,
  type ModulePage,
  type ModuleStatus,
} from './ModuleDefinition';
export {
  COLUMNS_BY_BREAKPOINT,
  GRID_COLUMNS,
  findFreeSlot,
  layoutForBreakpoint,
  layoutsForAllBreakpoints,
  readingOrder,
  rowSpanForBreakpoint,
  seSolapan,
  validateLayout,
  type Breakpoint,
  type GridPosition,
  type GridProblem,
} from './grid';
export {
  applyPersonalization,
  assertPersonalizationIsPresentationOnly,
  describeProvenance,
  type UserPersonalization,
  type ViewProvenance,
} from './personalization';
export {
  PATRONES_DE_INTERACCION,
  bookmarkToUrl,
  captureBookmark,
  drillThroughUrl,
  type Bookmark,
  type DrillThroughTarget,
  type InteractionPattern,
  type InteractionPatternSpec,
} from './interaccion';

export {
  TIPO_DESCONOCIDO,
  findPublishBlockers,
  normalizarColumna,
  validateModule,
  type ColumnaDisponible,
  type DatasetInfo,
  type ItemDiagnostic,
  type ModuleDiagnostics,
  type PublishBlocker,
  type ValidateModuleInput,
} from './validation';
export { saludDe, type ResumenDeSalud, type SaludDeModulo } from './salud';
