import { type CacheEntry, type ICacheStore } from './ICacheStore';

/**
 * Cache en memoria del proceso — L1 de la seccion 6.3.
 *
 * Por instancia, con TTL muy corto (segundos). NO es la fuente de verdad: solo evita golpear
 * el Storage Account repetidamente cuando varios objetos de una misma carga de pagina piden
 * la misma clave.
 *
 * Tiene un segundo papel, el de la seccion 6.9: si el Storage Account no esta disponible, la
 * aplicacion sigue sirviendo desde aqui mientras dure la interrupcion, mostrando de forma
 * honesta la marca de tiempo del ultimo dato valido conocido. Para eso, una entrada expirada
 * no se borra: se marca vencida y `getEvenIfExpired` puede recuperarla.
 */
export interface InMemoryCacheStoreOptions {
  /** TTL en milisegundos. Segundos, no minutos: L1 reduce round-trips, no sustituye a L2. */
  ttlMs?: number;
  /** Entradas maximas antes de descartar la mas antigua. Acota la memoria del proceso. */
  maxEntries?: number;
  /** Reloj inyectable, para poder probar la expiracion sin esperar. */
  now?: () => number;
}

interface StoredEntry {
  entry: CacheEntry<unknown>;
  storedAt: number;
}

export class InMemoryCacheStore implements ICacheStore {
  private readonly map = new Map<string, StoredEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: InMemoryCacheStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5_000;
    this.maxEntries = options.maxEntries ?? 500;
    this.now = options.now ?? Date.now;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const guardado = this.map.get(key);
    if (!guardado) return null;
    if (this.now() - guardado.storedAt > this.ttlMs) return null;
    return guardado.entry as CacheEntry<T>;
  }

  /**
   * Devuelve la entrada aunque su TTL haya vencido.
   *
   * Solo la usa el camino de degradacion de 6.9, cuando L2 no responde: es preferible servir
   * el ultimo dato valido conocido, con su fecha visible, a devolver un error — y en ningun
   * caso se recurre a una consulta sincrona a la fuente como contingencia.
   */
  async getEvenIfExpired<T>(key: string): Promise<{ entry: CacheEntry<T>; expired: boolean } | null> {
    const guardado = this.map.get(key);
    if (!guardado) return null;
    return {
      entry: guardado.entry as CacheEntry<T>,
      expired: this.now() - guardado.storedAt > this.ttlMs,
    };
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (this.map.size >= this.maxEntries && !this.map.has(key)) {
      const masAntigua = this.map.keys().next();
      if (!masAntigua.done) this.map.delete(masAntigua.value);
    }
    this.map.set(key, { entry: entry as CacheEntry<unknown>, storedAt: this.now() });
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(prefix)) this.map.delete(key);
    }
  }

  /** Solo para pruebas y metricas de salud. */
  get size(): number {
    return this.map.size;
  }
}
