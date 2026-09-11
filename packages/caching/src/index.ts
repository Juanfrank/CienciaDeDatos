/**
 * Cache de la aplicacion — seccion 6 del contrato de ingenieria.
 *
 * El caching aqui no es una optimizacion de rendimiento: es la arquitectura de lectura
 * completa. Ninguna solicitud de un modulo, disparada por una persona usuaria, invoca
 * IDataConnector.query(). La persona usuaria siempre lee de un cache ya poblado; la poblacion
 * de ese cache ocurre en un proceso separado (apps/cache-populator), desacoplado del ciclo de
 * vida de cualquier solicitud HTTP.
 *
 * Este paquete esta etiquetado `type:server` y NO puede importar `type:server-data`. La regla
 * de limites hace imposible, no solo desaconsejable, que el camino de lectura alcance un
 * conector de datos.
 */
export { BlobCacheStore, type BlobCacheStoreOptions } from './BlobCacheStore';
export {
  CachedDatasetReader,
  applyRequestedFilters,
  type CacheReadEvent,
  type CachedDatasetReaderOptions,
  type ReadDatasetInput,
  type ReadResult,
  type ReadStatus,
} from './CachedDatasetReader';
export { FileCacheStore, type FileCacheStoreOptions } from './FileCacheStore';
export {
  CacheStoreUnavailableError,
  type CacheEntry,
  type ICacheStore,
} from './ICacheStore';
export { InMemoryCacheStore, type InMemoryCacheStoreOptions } from './InMemoryCacheStore';
export {
  SCHEMA_CACHE_KEY,
  buildCacheKey,
  datasetKeyPrefix,
  stableHash,
  type CacheKeyInput,
  type SecurityBinding,
} from './cacheKey';
export {
  UnknownDatasetError,
  datasetsForModule,
  defaultRegistry,
  getDataset,
  validateRegistry,
  type CacheableDataset,
  type DatasetRegistry,
  type RegistryProblem,
} from './datasetRegistry';
