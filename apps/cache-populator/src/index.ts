/** Job de poblacion de cache — seccion 6.4. */
export {
  populate,
  refreshSchema,
  repopulateTargeted,
  type PopulateOptions,
  type PopulateResult,
  type PopulationSecurityContext,
} from './populate';
export {
  CronParseError,
  isDue,
  matchesCron,
  parseCron,
  type CronFields,
} from './schedule';
export { runScheduledCycle, type ScheduledCycleOptions } from './runCycle';
