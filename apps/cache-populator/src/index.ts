/**
 * Job de poblacion de cache — seccion 6.4.
 *
 * UNICO proyecto del monorepo autorizado a importar `@app/data-contracts-server`, y por tanto el
 * unico que invoca IDataConnector.query(). Esa exclusividad la hace cumplir la regla de limites
 * de dependencia (`type:job`), no una convencion, y se comprueba en cada CI con
 * `npm run verify:boundaries`.
 *
 * Corre desacoplado del ciclo de vida de cualquier solicitud HTTP: la persona usuaria nunca
 * espera a que esto termine, lee de lo que ya este poblado.
 */
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
