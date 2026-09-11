import { join } from 'node:path';
import { FileCacheStore, InMemoryCacheStore, type ICacheStore } from '@app/caching';

/**
 * Estado de aplicacion compartido entre instancias — criterio de la seccion 9:
 * "la aplicacion escala a mas de una instancia sin perdida de sesion ni de estado de
 * personalizacion en edicion".
 *
 * Sesion, marcadores, gobierno y auditoria vivian en un mapa por proceso. Con una sola instancia
 * no se nota; con dos, quien cae en la segunda pierde la sesion, no ve sus marcadores y —lo
 * grave— lee el gobierno anterior al ultimo cambio del Administrador. Un ambito reducido en la
 * instancia A no se aplicaba en la B.
 *
 * Aqui viven sobre el mismo `ICacheStore` que ya comparten el shell y el job. No es el sitio
 * definitivo: la seccion 4.10.7 situa el gobierno y los marcadores en la base de identidad, y
 * ADR-006 la sesion en su tabla. El puerto de cada almacen es lo que permite ese cambio sin
 * tocar ni la interfaz ni la logica; lo que se gana ya es lo que importa — que el estado NO sea
 * del proceso.
 *
 * Limite conocido: `ICacheStore` no ofrece lectura-modificacion-escritura atomica, asi que dos
 * escrituras simultaneas sobre la misma clave pueden pisarse. En la base de identidad lo
 * resuelve una transaccion. Aqui se acota escribiendo por entidad y no por coleccion entera
 * donde tiene sentido, y se deja escrito para que nadie lo confunda con un almacen transaccional.
 */

/** Directorio del cache L2, compartido con el job de poblacion y entre instancias. */
export const CACHE_DIR = process.env['CACHE_DIR'] ?? join(process.cwd(), '.cache-datos');

/**
 * El store se construye AQUI y no en `contexto.ts`.
 *
 * Antes lo hacia contexto, y eso creaba un ciclo: contexto importa el gobierno, el gobierno
 * importa este modulo, y este importaba contexto. En tiempo de carga uno de los tres veia al
 * otro a medio inicializar y el store llegaba sin definir. El ciclo se rompe poniendo el dato
 * mas basico —donde se guarda— en el modulo que no depende de nadie.
 */
export const cacheL2: ICacheStore = new FileCacheStore({ directory: CACHE_DIR });

/**
 * L1 por proceso con TTL corto, delante del L2 en disco.
 *
 * L2 es un archivo y no memoria porque el job de poblacion corre en OTRO proceso —y porque con
 * varias instancias, un L2 en memoria daria a cada una su propia version del mundo.
 */
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
