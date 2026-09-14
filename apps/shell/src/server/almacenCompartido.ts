import { join } from 'node:path';
import { FileCacheStore, InMemoryCacheStore, mutate, type ICacheStore } from '@app/caching';

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

export async function write<T>(clave: string, valor: T): Promise<void> {
  await store.set(clave, { value: valor, generatedAt: new Date().toISOString() });
}

/**
 * Lee, transforma y escribe SIN que otra peticion se cuele en medio.
 *
 * Es lo que hay que usar siempre que el valor nuevo dependa del guardado: `leer` y luego `write`
 * son dos operaciones, y entre las dos cabe otra peticion entera. No falla ni avisa — la segunda
 * escritura pisa lo que anadio la primera y falta una fila que nadie echa en falta hasta que la
 * busca.
 */
export async function mutar<T>(clave: string, cambio: (actual: T | undefined) => T): Promise<T> {
  return mutate<T>(store, clave, cambio);
}

export async function borrar(clave: string): Promise<void> {
  await store.delete(clave);
}

/** Claves del estado de aplicacion. Agrupadas aqui para verlas todas de una vez. */
export const GOVERNANCE_KEY = 'app:gobierno';
export const KEY_BOOKMARKS = 'app:marcadores';
export const KEY_AUDIT = 'app:auditoria';

/** Lista con valor por defecto, para las colecciones que empiezan vacias. */
export async function readList<T>(clave: string): Promise<T[]> {
  return (await leer<T[]>(clave)) ?? [];
}
