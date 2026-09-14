import { test as base, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Cada worker habla con SU pareja de instancias y con SU almacen.
 *
 * La suite corria con un solo worker porque todas las pruebas compartian un almacen en disco:
 * dos en paralelo se pisaban el gobierno, las sesiones y los modulos. La solucion no es
 * serializar, es aislar — cada worker arranca su propio par de servidores sobre su propio
 * directorio de cache, y dentro de el vuelve a valer lo que valia antes.
 *
 * Los puertos salen del indice del worker, no de una constante: `parallelIndex` es estable
 * mientras el worker vive y no se repite entre workers simultaneos, que es justo lo que hace
 * falta para que dos no compartan servidor.
 */

export const PUERTO_BASE = 4310;

/** El par de puertos del worker `indice`: la instancia principal y la segunda. */
export function puertosDe(indice: number): { principal: number; segunda: number } {
  return { principal: PUERTO_BASE + indice * 2, segunda: PUERTO_BASE + indice * 2 + 1 };
}

export const test = base.extend<
  { origen: string; instanceOther: string },
  { puertos: { principal: number; segunda: number } }
>({
  puertos: [
    // eslint-disable-next-line no-empty-pattern -- la firma de un fixture de Playwright.
    async ({}, use, workerInfo) => {
      await use(puertosDe(workerInfo.parallelIndex));
    },
    { scope: 'worker' },
  ],

  /**
   * `baseURL` se sobrescribe por worker.
   *
   * Es una opcion incorporada de Playwright, y sobrescribirla aqui es lo que hace que
   * `page.goto('/editor')` y `page.request.post('/api/...')` de las 424 pruebas apunten al
   * servidor correcto sin tocar ni una linea de ellas.
   */
  baseURL: async ({ puertos }, use) => {
    await use(`http://localhost:${puertos.principal}`);
  },

  /** El origen de este worker, para lo que necesita la URL absoluta: una cookie, un origen. */
  origen: async ({ puertos }, use) => {
    await use(`http://localhost:${puertos.principal}`);
  },

  /** La SEGUNDA instancia del mismo worker, que lee y escribe el mismo almacen. */
  instanceOther: async ({ puertos }, use) => {
    await use(`http://localhost:${puertos.segunda}`);
  },
});

export { expect };
export type { Locator, Page };
