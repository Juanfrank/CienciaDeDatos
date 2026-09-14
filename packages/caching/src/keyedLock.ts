import type { ICacheStore } from './ICacheStore';

/**
 * Lectura-modificacion-escritura sin que dos peticiones a la vez se pisen.
 *
 * El store escribe de forma atomica —temporal y `rename`—, asi que nunca se lee un JSON a medias.
 * Lo que NO impide es la actualizacion perdida, que es otra cosa: dos peticiones simultaneas leen
 * la misma lista, cada una le anade lo suyo, y la segunda en escribir borra lo que anadio la
 * primera. No hay error, no hay excepcion y no hay rastro; sencillamente falta una fila.
 *
 * Donde mas duele es en el registro de auditoria: dos cambios de configuracion a la vez y uno de
 * los dos no queda anotado. Un registro que a veces pierde la fila que importa no sirve para lo
 * que existe.
 *
 * La cola es POR CLAVE: dos escrituras de la misma clave se ponen en fila, dos de claves
 * distintas siguen a la vez. Serializarlo todo convertiria el almacen en un cuello de botella
 * por una colision que solo ocurre entre iguales.
 *
 * Su alcance es el PROCESO. Con varias instancias hace falta que lo garantice el almacen —una
 * transaccion en Azure SQL, que es a donde va esto—, y por eso el puerto no cambia: quien
 * implemente `ICacheStore` sobre una base de datos resuelve el caso de varias instancias sin que
 * quien llama se entere.
 */

export interface KeyedLock {
  <T>(clave: string, tarea: () => Promise<T>): Promise<T>;
  /**
   * Cuantas claves tienen turno abierto. Solo para diagnostico y pruebas — mismo criterio que
   * `keys()` en el store: el mapa de colas es estado vivo del proceso, y que se vacie solo se
   * puede comprobar mirandolo.
   */
  readonly abiertas: number;
}

export function keyedLock(): KeyedLock {
  const colas = new Map<string, Promise<void>>();

  const tomar = async <T>(clave: string, tarea: () => Promise<T>): Promise<T> => {
    const anterior = colas.get(clave) ?? Promise.resolve();

    // El turno propio se cierra a mano, en el `finally`: encadenar directamente sobre `tarea`
    // dejaria la clave bloqueada para siempre en cuanto una mutacion lanzara.
    let liberar!: () => void;
    const turno = new Promise<void>((listo) => {
      liberar = listo;
    });
    const cola = anterior.then(() => turno);
    colas.set(clave, cola);

    await anterior;
    try {
      return await tarea();
    } finally {
      liberar();
      // La entrada se borra solo si nadie se puso detras: borrarla siempre haria que el
      // siguiente en llegar se encadenara sobre nada y corriera a la vez que quien ya esperaba.
      if (colas.get(clave) === cola) colas.delete(clave);
    }
  };

  return Object.defineProperty(tomar, 'abiertas', { get: () => colas.size }) as KeyedLock;
}

/** El turno compartido del proceso. Que sea uno solo es lo que hace que dos llamantes distintos
 *  que tocan la misma clave se vean entre si. */
export const LOCK_PROCESS: KeyedLock = keyedLock();

export interface MutateOptions {
  /** Inyectable para poder probar el paso del tiempo sin esperar. */
  ahora?: Date;
  lock?: KeyedLock;
}

/**
 * Lee una clave, la transforma y la escribe, con el turno tomado durante las tres cosas.
 *
 * Devuelve el valor ya escrito: quien llama no tiene que volver a leer para saber como quedo, y
 * volver a leer seria justo la ventana que esto cierra.
 *
 * Si el cambio devuelve EL MISMO valor que habia, no se escribe. Es lo que permite usar esto
 * tambien donde la mutacion puede no tener nada que hacer —un trabajador que mira una cola
 * vacia dos veces por segundo— sin convertir una lectura en una escritura a disco.
 */
export async function mutate<T>(
  store: ICacheStore,
  clave: string,
  cambio: (actual: T | undefined) => T,
  options: MutateOptions = {},
): Promise<T> {
  const lock = options.lock ?? LOCK_PROCESS;
  return lock(clave, async () => {
    const entrada = await store.get<T>(clave);
    const siguiente = cambio(entrada?.value);
    if (entrada !== null && siguiente === entrada.value) return siguiente;
    await store.set(clave, {
      value: siguiente,
      generatedAt: (options.ahora ?? new Date()).toISOString(),
    });
    return siguiente;
  });
}
