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
  overlapItself,
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
  INTERACTION_PATTERNS,
  bookmarkToUrl,
  captureBookmark,
  drillThroughUrl,
  type Bookmark,
  type DrillThroughTarget,
  type InteractionPattern,
  type InteractionPatternSpec,
} from './interaction';

export {
  UNKNOWN_KIND,
  findPublishBlockers,
  columnNormalize,
  validateModule,
  type AvailableColumn,
  type DatasetInfo,
  type ItemDiagnostic,
  type ModuleDiagnostics,
  type PublishBlocker,
  type ValidateModuleInput,
} from './validation';
export { healthOf, type HealthSummary, type ModuleHealth } from './health';
export { diffModules, type ModuleDiff, type ObjectChange } from './diff';
