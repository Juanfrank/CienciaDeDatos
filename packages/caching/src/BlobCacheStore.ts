import { RestError, type ContainerClient } from '@azure/storage-blob';
import { type CacheEntry, CacheStoreUnavailableError, type ICacheStore } from './ICacheStore';

/** L2: Azure Blob Storage — seccion 6.2. */
export interface BlobCacheStoreOptions {
  container: ContainerClient;
  /** Prefijo opcional dentro del contenedor, para convivir con otros usos del mismo Storage. */
  prefix?: string;
}

/**
 * Los nombres de blob admiten mas caracteres de los que usa nuestra clave, pero se codifica
 * de todas formas: una clave lleva hashes y separadores `:`, y `:` es problematico en algunas
 * herramientas de inspeccion de Storage.
 */
const encodeKey = (key: string): string => key.replace(/:/g, '__');

/**
 * La vuelta, para `keysByPrefix`. Da por hecho que ninguna clave lleva `__` por si misma, que es
 * lo mismo que ya daba por hecho la codificacion: si alguna lo llevara, el nombre del blob seria
 * ambiguo en los dos sentidos.
 */
const decodeKey = (name: string): string => name.replace(/__/g, ':');

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Distingue "no existe" de "no se puede alcanzar": lo primero es normal, lo segundo degrada (6.9). */
function isNotFound(error: unknown): boolean {
  return error instanceof RestError && (error.statusCode === 404 || error.code === 'BlobNotFound');
}

export class BlobCacheStore implements ICacheStore {
  private readonly container: ContainerClient;
  private readonly prefix: string;

  constructor(options: BlobCacheStoreOptions) {
    this.container = options.container;
    this.prefix = options.prefix ?? '';
  }

  private blobName(key: string): string {
    return `${this.prefix}${encodeKey(key)}.json`;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const blob = this.container.getBlockBlobClient(this.blobName(key));
    try {
      const respuesta = await blob.download();
      if (!respuesta.readableStreamBody) return null;
      return JSON.parse(await readAll(respuesta.readableStreamBody)) as CacheEntry<T>;
    } catch (error) {
      if (isNotFound(error)) return null;
      // Cualquier otro fallo es indisponibilidad: el camino de lectura degrada a L1 (6.9)
      // en vez de tratarlo como error de aplicacion — y jamas consulta la fuente.
      throw new CacheStoreUnavailableError('BlobCacheStore', error);
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const blob = this.container.getBlockBlobClient(this.blobName(key));
    const body = JSON.stringify(entry);
    try {
      await blob.upload(body, Buffer.byteLength(body), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        metadata: {
          generatedAt: entry.generatedAt,
          ...(entry.datasetVersion ? { datasetVersion: entry.datasetVersion } : {}),
        },
      });
    } catch (error) {
      throw new CacheStoreUnavailableError('BlobCacheStore', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.container.getBlockBlobClient(this.blobName(key)).deleteIfExists();
    } catch (error) {
      throw new CacheStoreUnavailableError('BlobCacheStore', error);
    }
  }

  /**
   * Invalidacion dirigida (6.5): repuebla solo los datasets afectados por una carga
   * especifica, en vez de vaciar todo el cache.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      for await (const blob of this.listar(prefix)) {
        await this.container.getBlockBlobClient(blob.name).deleteIfExists();
      }
    } catch (error) {
      throw new CacheStoreUnavailableError('BlobCacheStore', error);
    }
  }

  async keysByPrefix(prefix: string): Promise<string[]> {
    try {
      const claves: string[] = [];
      for await (const blob of this.listar(prefix)) {
        claves.push(decodeKey(blob.name.slice(this.prefix.length)));
      }
      return claves.sort();
    } catch (error) {
      throw new CacheStoreUnavailableError('BlobCacheStore', error);
    }
  }

  private listar(prefix: string) {
    return this.container.listBlobsFlat({ prefix: `${this.prefix}${encodeKey(prefix)}` });
  }
}
