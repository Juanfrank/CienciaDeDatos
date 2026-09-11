/**
 * Store de cache — seccion 6.2 del contrato de ingenieria.
 *
 * Toda la logica de cache depende de esta interfaz, nunca de un SDK concreto, para que el
 * backend de almacenamiento sea sustituible sin tocar logica de negocio. Esa sustituibilidad
 * no es teorica: la seccion 6.1 deja Redis explicitamente fuera de esta fase por ser un
 * servicio de costo fijo, pero documentado como opcion de escalado futuro. El dia que se
 * justifique, `RedisCacheStore` se añade como una implementacion mas de esta interfaz,
 * seleccionable por configuracion — el mismo patron que ya rige IDataConnector.
 */

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
