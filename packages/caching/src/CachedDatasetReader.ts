import {
  applyFilters,
  parseFilters,
  splitFilterKey,
  type QueryResult,
} from '@app/data-contracts';
import {
  type AccessScope,
  assertScopeIsEnforceable,
  filterResultByScope,
  intersectRequestedFilters,
} from '@app/access-control';
import { buildCacheKey } from './cacheKey';
import { type CacheEntry, CacheStoreUnavailableError, type ICacheStore } from './ICacheStore';
import { type CacheableDataset, type DatasetRegistry, defaultRegistry, getDataset } from './datasetRegistry';
import type { InMemoryCacheStore } from './InMemoryCacheStore';

/** Camino de lectura de una solicitud de usuario — seccion 6.3. */

export type ReadStatus = 'ok' | 'generating' | 'degraded';

export interface ReadResult {
  status: ReadStatus;
  /** Presente salvo cuando status es 'generating'. Ya filtrado por el ambito de quien lee. */
  result?: QueryResult;
  /** Marca de tiempo del dato servido. Se muestra en la interfaz de cada modulo (4.8). */
  generatedAt?: string;
  servedFrom?: 'l1' | 'l2';
  /**
   * true cuando el dato viene de L1 con su TTL vencido porque L2 no respondia (6.9). La
   * interfaz debe mostrarlo de forma honesta junto con generatedAt, no disimularlo.
   */
  stale?: boolean;
  /** Filtros efectivamente aplicados, tras intersecar los pedidos con el ambito resuelto. */
  appliedFilters?: Record<string, string[]>;
}

export interface ReadDatasetInput {
  datasetId: string;
  /** Ambito efectivo ya resuelto por resolveEffectiveScope (4.10.4). */
  scope: AccessScope;
  /** Filtros pedidos por la interfaz o por parametros de URL. Se intersecan con el ambito. */
  requestedFilters?: Record<string, string | string[]>;
  /**
   * Contexto de seguridad, obligatorio solo si el dataset esta ligado a uno
   * (securityBinding: 'connector-native').
   */
  securityContext?: Record<string, string | string[]>;
}

export interface CachedDatasetReaderOptions {
  /** L1: memoria del proceso, TTL de segundos. */
  l1: InMemoryCacheStore;
  /** L2: Azure Storage, fuente de verdad del cache, compartida entre instancias. */
  l2: ICacheStore;
  registry?: DatasetRegistry;
  /** Observabilidad: se invoca en cada lectura, para la tasa de aciertos de cache (6.9). */
  onRead?: (evento: CacheReadEvent) => void;
}

export interface CacheReadEvent {
  datasetId: string;
  key: string;
  status: ReadStatus;
  servedFrom?: 'l1' | 'l2';
  stale: boolean;
  /** Antiguedad del dato servido, en milisegundos. Metrica de salud operativa, no de rendimiento. */
  ageMs?: number;
}

export class CachedDatasetReader {
  private readonly l1: InMemoryCacheStore;
  private readonly l2: ICacheStore;
  private readonly registry: DatasetRegistry;
  private readonly onRead: (evento: CacheReadEvent) => void;

  constructor(options: CachedDatasetReaderOptions) {
    this.l1 = options.l1;
    this.l2 = options.l2;
    this.registry = options.registry ?? defaultRegistry;
    this.onRead = options.onRead ?? (() => undefined);
  }

  async read(input: ReadDatasetInput): Promise<ReadResult> {
    const dataset = getDataset(input.datasetId, this.registry);
    const key = this.keyFor(dataset, input);

    // 1. L1 — evita golpear el Storage Account cuando varios objetos de una misma carga de
    //    pagina piden la misma clave.
    const enL1 = await this.l1.get<QueryResult>(key);
    if (enL1) return this.finish(dataset, input, key, enL1, 'l1', false);

    // 2. L2 — fuente de verdad del cache, compartida entre instancias.
    try {
      const enL2 = await this.l2.get<QueryResult>(key);
      if (enL2) {
        await this.l1.set(key, enL2);
        return this.finish(dataset, input, key, enL2, 'l2', false);
      }
    } catch (error) {
      if (!(error instanceof CacheStoreUnavailableError)) throw error;
      // 3. Degradacion de 6.9: L2 caido. Se sirve el ultimo dato valido conocido desde L1,
      //    aunque su TTL haya vencido, con su marca de tiempo visible. Bajo ninguna
      //    circunstancia se recurre a una consulta sincrona a la fuente.
      const vencido = await this.l1.getEvenIfExpired<QueryResult>(key);
      if (vencido) return this.finish(dataset, input, key, vencido.entry, 'l1', true);
    }

    // 4. No hay dato en ninguna capa. Estado explicito, nunca una consulta a la fuente.
    this.onRead({ datasetId: dataset.datasetId, key, status: 'generating', stale: false });
    return { status: 'generating' };
  }

  /** Clave del dataset para un contexto dado. Publica para que el job de poblacion use la misma. */
  keyFor(dataset: CacheableDataset, input: Pick<ReadDatasetInput, 'securityContext'>): string {
    return buildCacheKey({
      datasetId: dataset.datasetId,
      dimensions: dataset.query.dimensions,
      filters: dataset.query.filters,
      securityBinding: dataset.securityBinding,
      securityContext: input.securityContext,
    });
  }

  private finish(
    dataset: CacheableDataset,
    input: ReadDatasetInput,
    key: string,
    entry: CacheEntry<QueryResult>,
    servedFrom: 'l1' | 'l2',
    stale: boolean,
  ): ReadResult {
    // El filtrado de seguridad ocurre SIEMPRE antes de que el dato salga hacia el cliente,
    // tanto si vino ya filtrado de la fuente como si se comparte entre ambitos.
    assertScopeIsEnforceable(entry.value, input.scope);

    const pedidos = input.requestedFilters ?? {};
    const appliedFilters = intersectRequestedFilters(input.scope, planos(pedidos));
    const byScope = filterResultByScope(entry.value, input.scope);

    /*
     * Dos pasadas, y el orden no es casual.
     *
     * La primera es la de siempre: los valores pedidos ya INTERSECADOS con el ambito, de modo que
     * pedir un distrito que no se tiene concedido no lo trae. La segunda aplica los operadores
     * —excluir, contiene, empieza, rango, vacio— sobre lo que queda.
     *
     * Van despues a proposito: un operador solo puede QUITAR filas de lo que el ambito ya dejo
     * pasar, nunca anadir ninguna, asi que por mucho que alguien escriba en la URL no puede
     * ensanchar lo que ve. Intersecarlos con el ambito como se hace con los valores no tendria
     * sentido —un «contiene» no es una lista de valores permitidos— y mezclarlos en la primera
     * pasada habria puesto esa garantia en manos de la interseccion.
     */
    const result = applyFilters(
      applyRequestedFilters(byScope, appliedFilters),
      parseFilters(conOperador(pedidos)),
    );

    const ageMs = Date.now() - new Date(entry.generatedAt).getTime();
    const status: ReadStatus = stale ? 'degraded' : 'ok';
    this.onRead({ datasetId: dataset.datasetId, key, status, servedFrom, stale, ageMs });

    return {
      status,
      result,
      generatedAt: entry.generatedAt,
      servedFrom,
      stale,
      appliedFilters,
    };
  }
}

/**
 * Las claves SIN operador: el «pertenece a» de siempre, que es lo que el ambito sabe intersecar.
 *
 * `campo.desde` no es el nombre de ninguna columna, asi que pasarlas por la interseccion las
 * dejaba fuera y el lector las descartaba despues: el rango de fechas del panel de filtros se
 * escribia en la URL y no acotaba nada.
 */
const planos = (
  pedidos: Record<string, string | string[]>,
): Record<string, string | string[]> =>
  Object.fromEntries(
    Object.entries(pedidos).filter(([clave]) => splitFilterKey(clave).suffix === undefined),
  );

/** Y las que SI lo llevan, que son las que entienden los operadores. */
const conOperador = (
  pedidos: Record<string, string | string[]>,
): Record<string, string | string[]> =>
  Object.fromEntries(
    Object.entries(pedidos).filter(([clave]) => splitFilterKey(clave).suffix !== undefined),
  );

/** Aplica sobre el dataset ya cacheado los filtros efectivos. */
export function applyRequestedFilters(
  result: QueryResult,
  filters: Record<string, string[]>,
): QueryResult {
  const activas = Object.entries(filters)
    .map(([clave, valores]) => ({
      index: result.columns.findIndex((c) => c.name === clave),
      allowed: new Set(valores),
    }))
    .filter((f) => f.index >= 0);

  if (activas.length === 0) return result;

  return {
    ...result,
    rows: result.rows.filter((row) => activas.every((f) => f.allowed.has(String(row[f.index])))),
  };
}
