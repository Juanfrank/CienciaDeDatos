/** Observabilidad — seccion 7 del contrato de ingenieria. */
export {
  assertConfigChangeIsAuditable,
  assertQueryCameFromPopulator,
  type CacheServeLog,
  type ConfigChangeLog,
  type GovernedQueryLog,
} from './auditEvents';
export {
  CacheMetrics,
  type LecturaDeCache,
  type ResumenDeCache,
} from './cacheMetrics';
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
