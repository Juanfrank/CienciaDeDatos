/**
 * Definicion de modulo — secciones 4.1, 4.2 y 4.6.
 *
 * Es el documento que produce el editor y consume el renderizador: que objetos hay, donde
 * estan, y contra que dataset se enlazan. Nunca una consulta, ni una cadena de conexion, ni
 * nada que revele la fuente activa.
 */
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
  findPublishBlockers,
  validateModule,
  type ItemDiagnostic,
  type ModuleDiagnostics,
  type PublishBlocker,
  type ValidateModuleInput,
} from './validation';
