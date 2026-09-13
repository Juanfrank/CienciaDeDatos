import type { IDataConnector } from '@app/data-contracts';
import { type DatasetRegistry, type ICacheStore, defaultRegistry } from '@app/caching';
import {
  POPULATOR_HEARTBEAT_KEY,
  type GovernedQueryLog,
  type PopulatorHeartbeat,
} from '@app/observability';
import { populate, refreshSchema, type PopulateResult } from './populate';
import { isDue } from './schedule';

/** Un ciclo completo del job: lo que ejecuta el Timer Trigger. */
export interface ScheduledCycleOptions {
  connector: IDataConnector;
  cacheStore: ICacheStore;
  connectorKind: 'mock' | 'sql' | 'xmla';
  registry?: DatasetRegistry;
  /** Cada cuanto refrescar el esquema. Por defecto, cada 12 horas. */
  schemaRefreshIntervalMs?: number;
  now?: () => Date;
  onQueryLog?: (log: GovernedQueryLog) => void;
}

export async function runScheduledCycle(
  options: ScheduledCycleOptions,
): Promise<PopulateResult & { schemaRefreshed: boolean }> {
  const now = options.now ?? (() => new Date());
  const registry = options.registry ?? defaultRegistry;
  const intervaloEsquema = options.schemaRefreshIntervalMs ?? 12 * 60 * 60 * 1000;

  const anterior =
    (await options.cacheStore.get<PopulatorHeartbeat>(POPULATOR_HEARTBEAT_KEY))?.value ?? null;

  const resultado = await populate({
    connector: options.connector,
    cacheStore: options.cacheStore,
    registry,
    connectorKind: options.connectorKind,
    previousHeartbeat: anterior,
    now,
    ...(options.onQueryLog ? { onQueryLog: options.onQueryLog } : {}),
    isDue: (dataset, lastRunAt, ahora) => isDue(dataset.recurrence, lastRunAt, ahora),
  });

  const lastScheme = anterior?.schemaRefreshedAt;
  const tocaEsquema =
    !lastScheme || now().getTime() - new Date(lastScheme).getTime() >= intervaloEsquema;

  let schemaRefreshed = false;
  if (tocaEsquema) {
    const schema = await refreshSchema({
      connector: options.connector,
      cacheStore: options.cacheStore,
      now,
    });
    schemaRefreshed = schema !== null;

    if (schemaRefreshed) {
      // El latido ya se escribio dentro de populate(); se reescribe con la marca del esquema
      // para que /health pueda reportar tambien cuando se refresco por ultima vez.
      const withScheme: PopulatorHeartbeat = {
        ...resultado.heartbeat,
        schemaRefreshedAt: now().toISOString(),
      };
      await options.cacheStore.set(POPULATOR_HEARTBEAT_KEY, {
        value: withScheme,
        generatedAt: withScheme.finishedAt,
      });
      return { ...resultado, heartbeat: withScheme, schemaRefreshed };
    }
  }

  return { ...resultado, schemaRefreshed };
}
