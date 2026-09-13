/** Store de cache — seccion 6.2 del contrato de ingenieria. */

export interface CacheEntry<T> {
  value: T;
  /** Cuando se calculo por ultima vez. Se muestra en la interfaz de cada modulo (4.8). */
  generatedAt: string;
  /** Para invalidacion dirigida (6.5). */
  datasetVersion?: string;
}

export interface ICacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  /** Invalidacion dirigida por etiqueta: repuebla solo lo afectado, no vacia todo el cache. */
  deleteByPrefix(prefix: string): Promise<void>;
}

/**
 * Fallo de acceso al store. Lo distingue del resto para que el camino de lectura pueda
 * degradarse a L1 (6.9) en vez de tratarlo como un error de aplicacion.
 */
export class CacheStoreUnavailableError extends Error {
  constructor(
    readonly store: string,
    readonly cause?: unknown,
  ) {
    super(`El store de cache '${store}' no esta disponible.`);
    this.name = 'CacheStoreUnavailableError';
  }
}
