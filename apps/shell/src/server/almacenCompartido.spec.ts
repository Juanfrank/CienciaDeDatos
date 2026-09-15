import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cacheDir, cacheL1, cacheL2, leer, write } from './almacenCompartido';

/**
 * El almacen SIGUE al directorio; no lo captura al importarse.
 *
 * Suena a detalle de implementacion y es lo que sostiene el aislamiento de toda la suite.
 * `vitest.setup.mts` le da a cada archivo de prueba su propio directorio temporal para que una
 * prueba que escribe no deje huella en la siguiente. Eso solo funciona si el almacen pregunta por
 * el directorio CADA VEZ. Mientras fue
 *
 *     export const CACHE_DIR = process.env['CACHE_DIR'] ?? …
 *
 * lo leia una sola vez, al evaluar el modulo, y el segundo archivo que compartiera proceso seguia
 * escribiendo en el directorio del primero. Con un proceso por archivo no se notaba; al
 * reutilizarlos —`isolate: false`, que baja la suite de doce segundos a cuatro— se notaria, y en
 * silencio: la suite seguiria en verde.
 *
 * Por eso esto se comprueba DENTRO de un archivo, cambiando la variable a mano, en vez de fiarlo a
 * que dos archivos caigan en el mismo proceso. Una guarda que depende del reparto de trabajos no
 * es una guarda: es un sorteo.
 */

const original = process.env['CACHE_DIR'];

afterEach(() => {
  if (original === undefined) delete process.env['CACHE_DIR'];
  else process.env['CACHE_DIR'] = original;
});

describe('el almacen compartido y el directorio vigente', () => {
  it('escribe en el directorio que dice la variable AHORA, no en el de cuando se importo', async () => {
    await write('sonda-de-aislamiento', 'del primero');
    expect(await leer('sonda-de-aislamiento')).toBe('del primero');

    // Otro directorio, como el que `vitest.setup.mts` da al archivo siguiente.
    process.env['CACHE_DIR'] = mkdtempSync(join(tmpdir(), 'sonda-de-aislamiento-'));

    // Vacio: si esto trae 'del primero', el almacen sigue apuntando al directorio de antes y el
    // aislamiento entre archivos de prueba no existe.
    expect(await leer('sonda-de-aislamiento')).toBeUndefined();

    await write('sonda-de-aislamiento', 'del segundo');
    expect(await leer('sonda-de-aislamiento')).toBe('del segundo');

    // Y al volver, lo del primero sigue donde estaba: son dos almacenes, no uno pisado.
    process.env['CACHE_DIR'] = original as string;
    expect(await leer('sonda-de-aislamiento')).toBe('del primero');
  });

  it('y `cacheDir` dice el vigente, para quien necesite el camino', () => {
    const otro = mkdtempSync(join(tmpdir(), 'sonda-de-aislamiento-'));
    process.env['CACHE_DIR'] = otro;
    expect(cacheDir()).toBe(otro);
  });

  /*
   * El L1 es la memoria DE ESE disco.
   *
   * Sin vaciarlo al cambiar de directorio, una lectura del archivo siguiente se serviria de
   * memoria y ni siquiera llegaria a mirar el directorio nuevo — el mismo fallo, un piso mas
   * arriba y mas dificil de ver, porque depende de que no hayan pasado los cinco segundos del TTL.
   */
  it('al cambiar de directorio, la memoria de delante se tira', async () => {
    await cacheL1.set('sonda-l1', { value: 1, generatedAt: new Date().toISOString() });
    expect(cacheL1.size).toBeGreaterThan(0);

    process.env['CACHE_DIR'] = mkdtempSync(join(tmpdir(), 'sonda-de-aislamiento-'));
    // Cualquier operacion sobre el disco es la que descubre el cambio.
    await cacheL2.get('lo-que-sea');

    expect(cacheL1.size).toBe(0);
  });
});
