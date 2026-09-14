/** Cache de la aplicacion — seccion 6 del contrato de ingenieria. */
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
export { LOCK_PROCESS, keyedLock, mutate, type KeyedLock, type MutateOptions } from './keyedLock';
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
