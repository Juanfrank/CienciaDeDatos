/** Definicion de modulo — secciones 4.1, 4.2 y 4.6. */
export {
  MODULE_OPTIONS,
  datasetsConsumedBy,
  findPage,
  instancesOf,
  moduleOptionOn,
  moduleUrl,
  type DefaultFilter,
  type GridItem,
  type ModuleDefinition,
  type ModuleOption,
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
  applyModuleOperation,
  applyModuleOperations,
  type ModuleOperation,
  type ModuleOperationResult,
} from './moduleOperations';
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
  drillLinks,
  drillProblems,
  drillThroughUrl,
  type Bookmark,
  type DrillLink,
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
export {
  NAVIGATOR_KINDS,
  NAVIGATOR_IS_PANEL,
  PANEL_BEHAVIORS,
  navigatorByDefault,
  navigatorProblems,
  type NavigatorKind,
  type NavigatorFilters,
  type PageNavigatorSettings,
  isPanelBehavior,
  panelBehavior,
  type PanelBehavior,
} from './pageNavigator';
