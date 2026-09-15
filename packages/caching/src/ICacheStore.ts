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
  /**
   * Las claves que empiezan por un prefijo. Es el gemelo de LECTURA de `deleteByPrefix`.
   *
   * Existe para el respaldo del estado autoritativo, que tiene que alcanzar claves por entidad
   * —`app:personalizacion:{userId}:{moduleId}`, una por persona y modulo— que nadie puede
   * enumerar de memoria. Va en el puerto y no en una implementacion porque el dia que el almacen
   * sea Blob o SQL es justo el dia en que la continuidad importa, y un respaldo atado al sistema
   * de archivos no serviria entonces.
   */
  keysByPrefix(prefix: string): Promise<string[]>;
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
