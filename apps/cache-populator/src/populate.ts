import type { IDataConnector, QueryContext, SchemaDescriptor } from '@app/data-contracts';
import {
  type CacheableDataset,
  type DatasetRegistry,
  type ICacheStore,
  buildCacheKey,
  datasetKeyPrefix,
  defaultRegistry,
} from '@app/caching';
import {
  POPULATOR_HEARTBEAT_KEY,
  type DatasetPopulationResult,
  type GovernedQueryLog,
  type PopulatorHeartbeat,
} from '@app/observability';

/**
 * Poblacion del cache — seccion 6.4.
 *
 * Este archivo es el UNICO de todo el repositorio que invoca IDataConnector.query(). No es una
 * convencion: `apps/cache-populator` es el unico proyecto etiquetado `type:job`, el unico que la
 * regla de limites autoriza a importar `@app/data-contracts-server`, y eso lo comprueba
 * `npm run verify:boundaries` en cada CI.
 *
 * Corre desacoplado del ciclo de vida de cualquier solicitud HTTP. La persona usuaria nunca
 * espera a que esto termine: lee de lo que este ya poblado.
 */

/** Clave del esquema cacheado, que consumen el editor (4.2) y la validacion de URL (4.11). */
export const SCHEMA_CACHE_KEY = 'ops:schema:descriptor';

/**
 * Contexto de seguridad con el que el job consulta.
 *
 * Es deliberadamente VACIO cuando el dataset no esta ligado a un contexto concreto: el job pide
 * el superconjunto y el ambito se aplica al leer (6.6). Solo los datasets con
 * `securityBinding: 'connector-native'` se pueblan por contexto, y entonces hay una entrada por
 * contexto, que es el precio del aislamiento cuando la fuente filtra por su cuenta.
 */
export interface PopulationSecurityContext {
  ctx: QueryContext;
  securityContext?: Record<string, string | string[]>;
}

export interface PopulateOptions {
  connector: IDataConnector;
  cacheStore: ICacheStore;
  registry?: DatasetRegistry;
  /** Identificador del conector activo, para la trazabilidad de cada consulta. */
  connectorKind: 'mock' | 'sql' | 'xmla';
  /** Datasets concretos a poblar. Si se omite, se decide por recurrencia. */
  only?: string[];
  /** Latido de la ejecucion anterior, para saber a que datasets les toca. */
  previousHeartbeat?: PopulatorHeartbeat | null;
  /** Contextos de seguridad para los datasets ligados a uno. */
  securityContexts?: PopulationSecurityContext[];
  now?: () => Date;
  onQueryLog?: (log: GovernedQueryLog) => void;
  isDue?: (dataset: CacheableDataset, lastRunAt: string | undefined, now: Date) => boolean;
}

const contextoVacio: QueryContext = {
  userId: 'cache-populator',
  userPrincipalName: 'cache-populator@sistema',
  roles: [],
  securityContext: {},
};

/** Cuando corrio con exito por ultima vez cada dataset, segun el latido anterior. */
function lastSuccessByDataset(heartbeat: PopulatorHeartbeat | null | undefined): Record<string, string> {
  if (!heartbeat) return {};
  const salida: Record<string, string> = {};
  for (const d of heartbeat.datasets) {
    if (d.outcome === 'ok') salida[d.datasetId] = heartbeat.finishedAt;
  }
  return salida;
}

export interface PopulateResult {
  heartbeat: PopulatorHeartbeat;
  /** Datasets que se saltaron porque su recurrencia aun no se cumplia. */
  skipped: string[];
}

export async function populate(options: PopulateOptions): Promise<PopulateResult> {
  const {
    connector,
    cacheStore,
    registry = defaultRegistry,
    connectorKind,
    only,
    previousHeartbeat,
    securityContexts,
    onQueryLog = () => undefined,
    isDue,
  } = options;

  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const ultimoExito = lastSuccessByDataset(previousHeartbeat);

  // La conectividad se comprueba UNA vez por ejecucion y se reporta en el latido: /health la lee
  // de ahi en vez de abrir su propio camino hacia la fuente (principio 2).
  let connectorReachable = false;
  try {
    connectorReachable = await connector.testConnection();
  } catch {
    connectorReachable = false;
  }

  const resultados: DatasetPopulationResult[] = [];
  const skipped: string[] = [];

  for (const dataset of registry.datasets) {
    if (only && !only.includes(dataset.datasetId)) continue;
    if (!only && isDue && !isDue(dataset, ultimoExito[dataset.datasetId], startedAt)) {
      skipped.push(dataset.datasetId);
      continue;
    }

    const contextos =
      dataset.securityBinding === 'connector-native' && securityContexts?.length
        ? securityContexts
        : [{ ctx: contextoVacio }];

    for (const contexto of contextos) {
      resultados.push(await populateOne(dataset, contexto, {
        connector,
        cacheStore,
        connectorKind,
        onQueryLog,
        now,
      }));
    }
  }

  const finishedAt = now();
  const todosOk = resultados.length > 0 && resultados.every((r) => r.outcome === 'ok');

  const heartbeat: PopulatorHeartbeat = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    connector: connectorKind,
    connectorReachable,
    datasets: resultados,
    ...(todosOk
      ? { lastFullSuccessAt: finishedAt.toISOString() }
      : previousHeartbeat?.lastFullSuccessAt
        ? { lastFullSuccessAt: previousHeartbeat.lastFullSuccessAt }
        : {}),
    ...(previousHeartbeat?.schemaRefreshedAt ? { schemaRefreshedAt: previousHeartbeat.schemaRefreshedAt } : {}),
  };

  await cacheStore.set(POPULATOR_HEARTBEAT_KEY, {
    value: heartbeat,
    generatedAt: finishedAt.toISOString(),
  });

  return { heartbeat, skipped };
}

async function populateOne(
  dataset: CacheableDataset,
  contexto: PopulationSecurityContext,
  deps: {
    connector: IDataConnector;
    cacheStore: ICacheStore;
    connectorKind: 'mock' | 'sql' | 'xmla';
    onQueryLog: (log: GovernedQueryLog) => void;
    now: () => Date;
  },
): Promise<DatasetPopulationResult> {
  const inicio = Date.now();

  try {
    const resultado = await deps.connector.query(dataset.query, contexto.ctx);

    const key = buildCacheKey({
      datasetId: dataset.datasetId,
      dimensions: dataset.query.dimensions,
      filters: dataset.query.filters,
      securityBinding: dataset.securityBinding,
      ...(contexto.securityContext ? { securityContext: contexto.securityContext } : {}),
    });

    await deps.cacheStore.set(key, {
      value: resultado,
      generatedAt: resultado.generatedAt,
    });

    const durationMs = Date.now() - inicio;
    deps.onQueryLog({
      kind: 'governed-query',
      timestamp: deps.now().toISOString(),
      connector: deps.connectorKind,
      datasetId: dataset.datasetId,
      request: dataset.query,
      durationMs,
      rowCount: resultado.rows.length,
      outcome: 'ok',
      invokedBy: 'cache-populator',
    });

    return { datasetId: dataset.datasetId, outcome: 'ok', rowCount: resultado.rows.length, durationMs };
  } catch (error) {
    const durationMs = Date.now() - inicio;
    const mensaje = error instanceof Error ? error.message : String(error);

    // NO se borra la entrada anterior. El cache conserva la ultima version valida y la persona
    // usuaria sigue viendo ese dato, con su marca de tiempo visible, en vez de un error (6.4).
    deps.onQueryLog({
      kind: 'governed-query',
      timestamp: deps.now().toISOString(),
      connector: deps.connectorKind,
      datasetId: dataset.datasetId,
      request: dataset.query,
      durationMs,
      outcome: 'fallo',
      error: mensaje,
      invokedBy: 'cache-populator',
    });

    return { datasetId: dataset.datasetId, outcome: 'fallo', error: mensaje, durationMs };
  }
}

/**
 * Refresco del esquema cacheado (6.4), con recurrencia mas espaciada porque cambia poco.
 *
 * Lo consumen el editor de modulos y la validacion de parametros de URL sin tener que consultar
 * la fuente en cada validacion.
 */
export async function refreshSchema(options: {
  connector: IDataConnector;
  cacheStore: ICacheStore;
  now?: () => Date;
}): Promise<SchemaDescriptor | null> {
  const now = options.now ?? (() => new Date());
  try {
    const schema = await options.connector.getSchema();
    await options.cacheStore.set(SCHEMA_CACHE_KEY, {
      value: schema,
      generatedAt: now().toISOString(),
    });
    return schema;
  } catch {
    // Igual que con los datasets: se conserva el esquema anterior antes que dejar al editor sin
    // nada con lo que validar.
    return null;
  }
}

/**
 * Repoblacion dirigida (6.5), que dispara el webhook de la capa de analisis (4.8).
 *
 * Invalida por prefijo solo los datasets afectados por esa carga y los vuelve a poblar, en vez
 * de vaciar todo el cache y esperar al siguiente ciclo programado.
 */
export async function repopulateTargeted(
  datasetIds: string[],
  options: Omit<PopulateOptions, 'only'>,
): Promise<PopulateResult> {
  for (const datasetId of datasetIds) {
    await options.cacheStore.deleteByPrefix(datasetKeyPrefix(datasetId));
  }
  return populate({ ...options, only: datasetIds });
}
