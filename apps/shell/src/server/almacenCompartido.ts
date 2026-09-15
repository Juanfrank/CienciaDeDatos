import { join } from 'node:path';
import { FileCacheStore, InMemoryCacheStore, mutate, type ICacheStore } from '@app/caching';

/**
 * Estado de aplicacion compartido entre instancias — criterio de la seccion 9:
 * "la aplicacion escala a mas de una instancia sin perdida de sesion ni de estado de
 * personalizacion en edicion".
 */

/**
 * Directorio del cache L2, compartido con el job de poblacion y entre instancias.
 *
 * Es una FUNCION y no una constante, y eso importa. Era
 * `export const CACHE_DIR = process.env['CACHE_DIR'] ?? …`, que lee la variable UNA vez: cuando se
 * evalua el modulo. En produccion da igual —la variable no cambia despues de arrancar—, pero en
 * las pruebas cambia por cada archivo: `vitest.setup.mts` le da a cada uno su propio directorio
 * temporal para que una prueba que escribe no deje huella en la siguiente. Con la constante, el
 * segundo archivo que compartiera proceso seguia escribiendo en el directorio del primero, y el
 * aislamiento quedaba anulado sin que nada fallara.
 *
 * Mientras cada archivo tuvo su proceso el problema no se veia. Al reutilizarlos —`isolate: false`,
 * que baja la suite de doce segundos a cuatro— se veria, y en silencio. De ahi esto.
 */
export const cacheDir = (): string => process.env['CACHE_DIR'] ?? join(process.cwd(), '.cache-datos');

/** El almacen de disco vigente, reconstruido solo si el directorio cambio. */
let vigente: { dir: string; store: FileCacheStore } | undefined;

function enDisco(): ICacheStore {
  const dir = cacheDir();
  if (vigente?.dir !== dir) {
    vigente = { dir, store: new FileCacheStore({ directory: dir }) };
    // El L1 es la memoria DE ESE disco: si el disco cambia, lo que hay en memoria ya no le
    // corresponde. Vaciarlo aqui es lo que evita que una lectura de otro archivo se sirva de
    // memoria y ni siquiera llegue a mirar el directorio nuevo.
    cacheL1.vaciar();
  }
  return vigente.store;
}

/**
 * El almacen de disco, como fachada ESTABLE.
 *
 * Quien lo captura al importar —`exports.ts`, `alerts.ts`, `settings.ts`, `context.ts`— se queda
 * con este objeto para siempre, y este objeto pregunta por el directorio en cada operacion. Asi
 * ninguno de ellos tiene que enterarse de nada: el cambio es de una sola pieza.
 */
export const cacheL2: ICacheStore = {
  get: <T,>(clave: string) => enDisco().get<T>(clave),
  set: <T,>(clave: string, entrada: Parameters<ICacheStore['set']>[1]) =>
    enDisco().set<T>(clave, entrada as never),
  delete: (clave: string) => enDisco().delete(clave),
  deleteByPrefix: (prefijo: string) => enDisco().deleteByPrefix(prefijo),
  keysByPrefix: (prefijo: string) => enDisco().keysByPrefix(prefijo),
};

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
export const KEY_MODULES = 'app:modulos';
export const KEY_HISTORY = 'app:modulos:historial';
/** El centinela que distingue un despliegue nuevo de uno que perdio el estado. */
export const KEY_INSTALLATION = 'app:instalacion';

/** Lista con valor por defecto, para las colecciones que empiezan vacias. */
export async function readList<T>(clave: string): Promise<T[]> {
  return (await leer<T[]>(clave)) ?? [];
}
