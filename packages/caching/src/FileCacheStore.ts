import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type CacheEntry, CacheStoreUnavailableError, type ICacheStore } from './ICacheStore';

/** Store de cache sobre disco — implementacion de DESARROLLO. */
export interface FileCacheStoreOptions {
  /** Directorio raiz. Se crea si no existe. */
  directory: string;
}

/**
 * Las claves llevan `:` y `/` no es valido en un nombre de archivo en todas las plataformas.
 * Se codifica de forma reversible para poder listar por prefijo sin ambiguedad.
 */
const encodeKey = (key: string): string => encodeURIComponent(key);
const decodeKey = (name: string): string => decodeURIComponent(name.replace(/\.json$/, ''));

export class FileCacheStore implements ICacheStore {
  private readonly directory: string;

  constructor(options: FileCacheStoreOptions) {
    this.directory = options.directory;
  }

  private pathFor(key: string): string {
    return join(this.directory, `${encodeKey(key)}.json`);
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      return JSON.parse(await readFile(this.pathFor(key), 'utf8')) as CacheEntry<T>;
    } catch (error) {
      // "No existe" es normal y no es indisponibilidad: significa que el job todavia no ha
      // poblado ese dataset, y el camino de lectura responde "generandose" (6.3).
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new CacheStoreUnavailableError('FileCacheStore', error);
    }
  }

  /** Contador de escrituras del proceso, para que dos simultaneas no compartan temporal. */
  private static escrituras = 0;

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const path = this.pathFor(key);
    try {
      await mkdir(dirname(path), { recursive: true });
      // Escritura atomica: el servidor puede estar leyendo mientras el job escribe, y un JSON
      // a medias se leeria como corrupto.
      //
      // El nombre temporal lleva un contador ademas del pid. Con solo el pid, dos escrituras
      // simultaneas de la MISMA clave dentro del mismo proceso comparten archivo temporal: la
      // primera lo renombra y la segunda falla con ENOENT. Ocurre en cuanto dos peticiones
      // concurrentes escriben lo mismo, y se manifiesta como un store "no disponible" que no
      // tiene nada que ver con el disco.
      const temporal = `${path}.${process.pid}.${++FileCacheStore.escrituras}.tmp`;
      await writeFile(temporal, JSON.stringify(entry), 'utf8');
      const { rename } = await import('node:fs/promises');
      await rename(temporal, path);
    } catch (error) {
      throw new CacheStoreUnavailableError('FileCacheStore', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(this.pathFor(key), { force: true });
    } catch (error) {
      throw new CacheStoreUnavailableError('FileCacheStore', error);
    }
  }

  /** Invalidacion dirigida (6.5): borra solo lo afectado, no vacia todo el cache. */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      const archivos = await readdir(this.directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [] as string[];
        throw error;
      });
      for (const archivo of archivos) {
        if (!archivo.endsWith('.json')) continue;
        if (decodeKey(archivo).startsWith(prefix)) {
          await rm(join(this.directory, archivo), { force: true });
        }
      }
    } catch (error) {
      throw new CacheStoreUnavailableError('FileCacheStore', error);
    }
  }

  /** Claves presentes. Solo para diagnostico y pruebas. */
  async keys(): Promise<string[]> {
    const archivos = await readdir(this.directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [] as string[];
      throw error;
    });
    return archivos.filter((a) => a.endsWith('.json')).map(decodeKey).sort();
  }
}
