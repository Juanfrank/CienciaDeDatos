import { describe, expect, it } from 'vitest';
import { InMemoryCacheStore } from './InMemoryCacheStore';
import { keyedLock, mutate } from './keyedLock';

/**
 * El turno por clave, probado con concurrencia de verdad y no con una descripcion de ella.
 *
 * Cada caso lanza las operaciones SIN esperar a la anterior y luego espera a todas: es la unica
 * forma de que la prueba vea la ventana que el turno cierra. Esperando una a una, el codigo sin
 * turno tambien pasaria, y la prueba seria verdad por el motivo equivocado.
 */

/** Un store que tarda en escribir: sin retardo la ventana es tan corta que nadie cae en ella. */
function lento(ms = 5) {
  const store = new InMemoryCacheStore({ ttlMs: 60_000 });
  const escribir = store.set.bind(store);
  store.set = async (clave, entrada) => {
    await new Promise((listo) => setTimeout(listo, ms));
    return escribir(clave, entrada);
  };
  return store;
}

describe('turno por clave', () => {
  it('diez anadidos simultaneos a la misma lista se conservan los diez', async () => {
    // Sin turno, los diez leen la lista vacia y el ultimo en escribir la deja con UN elemento.
    const store = lento();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        mutate<number[]>(store, 'lista', (actual) => [...(actual ?? []), i]),
      ),
    );

    const guardada = (await store.get<number[]>('lista'))?.value ?? [];
    expect(guardada).toHaveLength(10);
    expect([...guardada].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('claves distintas NO se esperan entre si', async () => {
    // El turno es por clave a proposito: serializarlo todo convertiria el almacen en una fila
    // unica por una colision que solo ocurre entre iguales.
    const store = lento(20);
    const inicio = Date.now();
    await Promise.all([
      mutate(store, 'a', () => 1),
      mutate(store, 'b', () => 1),
      mutate(store, 'c', () => 1),
    ]);
    // Tres escrituras de 20 ms en fila serian 60; en paralelo, poco mas de 20.
    expect(Date.now() - inicio).toBeLessThan(55);
  });

  it('una mutacion que lanza no deja la clave bloqueada', async () => {
    // Encadenando sobre la tarea en vez de sobre un turno propio, el primer fallo dejaria la
    // clave muerta: todo lo que llegara despues se quedaria esperando para siempre.
    const store = lento(1);
    const lock = keyedLock();

    await expect(
      lock('k', () => Promise.reject(new Error('revento'))),
    ).rejects.toThrow('revento');

    await expect(
      mutate(store, 'k', () => 'sigue viva', { lock }),
    ).resolves.toBe('sigue viva');
  });

  it('respeta el orden de llegada', async () => {
    const lock = keyedLock();
    const hechos: number[] = [];
    await Promise.all(
      [30, 20, 10].map((espera, i) =>
        lock('k', async () => {
          await new Promise((listo) => setTimeout(listo, espera));
          hechos.push(i);
        }),
      ),
    );
    // El primero en pedir turno es el primero en correr, aunque sea el mas lento.
    expect(hechos).toEqual([0, 1, 2]);
  });

  it('no acumula una entrada por cada clave vista', async () => {
    // El mapa de colas es estado vivo del proceso: si nunca se vaciara, un servidor con muchas
    // claves distintas —una por usuario, por ejemplo— lo veria crecer sin techo.
    const lock = keyedLock();
    for (let i = 0; i < 200; i += 1) await lock(`k${i}`, () => Promise.resolve(i));

    expect(lock.abiertas).toBe(0);

    // Y mientras hay espera de verdad, la clave SI figura: si no figurara nunca, el cero de
    // arriba seria cierto por no estar contando nada.
    let soltar!: () => void;
    const retenida = lock('k', () => new Promise<void>((listo) => (soltar = listo)));
    const detras = lock('k', () => Promise.resolve());
    await new Promise((listo) => setTimeout(listo, 0));
    expect(lock.abiertas).toBe(1);

    soltar();
    await Promise.all([retenida, detras]);
    expect(lock.abiertas).toBe(0);
  });

  it('un cambio que no cambia nada NO escribe', async () => {
    // Un trabajador mira su cola dos veces por segundo. Si mirar escribiera, el almacen tendria
    // una escritura a disco cada 500 ms sin que nada hubiera pasado.
    const store = lento(1);
    let escrituras = 0;
    const escribir = store.set.bind(store);
    store.set = async (clave, entrada) => {
      escrituras += 1;
      return escribir(clave, entrada);
    };

    await mutate<string[]>(store, 'cola', () => ['a']);
    expect(escrituras).toBe(1);

    // Devolver lo mismo que se recibio es la senal de «no habia nada que hacer».
    await mutate<string[]>(store, 'cola', (actual) => actual ?? []);
    await mutate<string[]>(store, 'cola', (actual) => actual ?? []);
    expect(escrituras).toBe(1);

    // Y un cambio de verdad sigue escribiendo.
    await mutate<string[]>(store, 'cola', (actual) => [...(actual ?? []), 'b']);
    expect(escrituras).toBe(2);
  });

  it('devuelve lo que quedo escrito, para no tener que volver a leer', async () => {
    // Volver a leer despues de escribir seria justo la ventana que esto cierra.
    const store = lento(1);
    const primera = await mutate<string[]>(store, 'l', (a) => [...(a ?? []), 'uno']);
    expect(primera).toEqual(['uno']);
  });
});
