import type { ConnectorKind } from '@app/data-contracts';

/** Latido del job de poblacion de cache. */

/** Clave fija del latido en el cache. No lleva contexto de seguridad: no contiene datos. */
export const POPULATOR_HEARTBEAT_KEY = 'ops:populator:heartbeat';

export interface DatasetPopulationResult {
  datasetId: string;
  outcome: 'ok' | 'fallo';
  /** Solo en caso de fallo. El cache conserva la version valida anterior (6.4). */
  error?: string;
  rowCount?: number;
  durationMs: number;
}

export interface PopulatorHeartbeat {
  /** Inicio de la ultima ejecucion del job. */
  startedAt: string;
  finishedAt: string;
  /** Conector que atendio la ejecucion. Es lo que /health reporta como conector activo. */
  connector: ConnectorKind;
  /** Resultado de testConnection() tal como lo observo el job, no una prueba del proceso web. */
  connectorReachable: boolean;
  datasets: DatasetPopulationResult[];
  /** Ultima ejecucion en la que TODOS los datasets se poblaron sin fallo. */
  lastFullSuccessAt?: string;
  /** Cuando se refresco por ultima vez el SchemaDescriptor cacheado (6.4). */
  schemaRefreshedAt?: string;
}

export function summarizeHeartbeat(hb: PopulatorHeartbeat): {
  total: number;
  fallidos: number;
  todosOk: boolean;
} {
  const fallidos = hb.datasets.filter((d) => d.outcome === 'fallo').length;
  return { total: hb.datasets.length, fallidos, todosOk: fallidos === 0 };
}
