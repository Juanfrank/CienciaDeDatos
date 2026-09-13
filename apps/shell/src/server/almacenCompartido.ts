import { join } from 'node:path';
import { FileCacheStore, InMemoryCacheStore, type ICacheStore } from '@app/caching';

/**
 * Estado de aplicacion compartido entre instancias — criterio de la seccion 9:
 * "la aplicacion escala a mas de una instancia sin perdida de sesion ni de estado de
 * personalizacion en edicion".
 */

/** Directorio del cache L2, compartido con el job de poblacion y entre instancias. */
export const CACHE_DIR = process.env['CACHE_DIR'] ?? join(process.cwd(), '.cache-datos');

/** El store se construye AQUI y no en `contexto.ts`. */
export const cacheL2: ICacheStore = new FileCacheStore({ directory: CACHE_DIR });

/** L1 por proceso con TTL corto, delante del L2 en disco. */
export const cacheL1 = new InMemoryCacheStore({ ttlMs: 5_000 });

const store: ICacheStore = cacheL2;

export async function leer<T>(clave: string): Promise<T | undefined> {
  const entrada = await store.get<T>(clave);
  return entrada?.value ?? undefined;
}

export async function escribir<T>(clave: string, valor: T): Promise<void> {
  await store.set(clave, { value: valor, generatedAt: new Date().toISOString() });
}

export async function borrar(clave: string): Promise<void> {
  await store.delete(clave);
}

/** Claves del estado de aplicacion. Agrupadas aqui para verlas todas de una vez. */
export const CLAVE_GOBIERNO = 'app:gobierno';
export const CLAVE_MARCADORES = 'app:marcadores';
export const CLAVE_AUDITORIA = 'app:auditoria';

/** Lista con valor por defecto, para las colecciones que empiezan vacias. */
export async function leerLista<T>(clave: string): Promise<T[]> {
  return (await leer<T[]>(clave)) ?? [];
}
