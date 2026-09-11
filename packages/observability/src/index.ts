/**
 * Observabilidad — seccion 7 del contrato de ingenieria.
 *
 * Contiene el contrato de /health, el latido que el job de poblacion deja en el cache, y las
 * formas de evento estructurado que alimentan el panel operativo.
 *
 * Etiquetado `type:server`: NO puede importar `type:server-data`. Eso es deliberado y es lo
 * que permite que /health reporte el conector activo sin instanciar ninguno.
 */
export {
  assertConfigChangeIsAuditable,
  assertQueryCameFromPopulator,
  type CacheServeLog,
  type ConfigChangeLog,
  type GovernedQueryLog,
} from './auditEvents';
export {
  buildHealthReport,
  type HealthCheckResult,
  type HealthProbeInput,
  type HealthReport,
  type HealthStatus,
} from './health';
export {
  POPULATOR_HEARTBEAT_KEY,
  summarizeHeartbeat,
  type DatasetPopulationResult,
  type PopulatorHeartbeat,
} from './heartbeat';
