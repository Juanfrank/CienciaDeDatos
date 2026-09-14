import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { objectRegistry } from './context';

/**
 * Todo `getByTestId` de una prueba tiene que poder existir.
 *
 * Un identificador de prueba es un contrato entre dos archivos que nada ata: el componente lo
 * escribe y la prueba lo busca. Cuando el componente lo construye con una plantilla
 * —`add-${objectId}`— el renombrado ve el nombre entero en la prueba y solo un trozo en el
 * componente, asi que traduce uno y deja el otro. La prueba no falla al compilar: falla treinta
 * segundos despues, esperando un elemento que nadie dibuja, y hay que correr ocho minutos de
 * navegador para enterarse. Aqui tarda un segundo.
 *
 * No comprueba que el elemento se dibuje —eso es trabajo del navegador—, solo que el nombre
 * corresponda a algo que algun componente escribe: un testid literal, un prefijo de plantilla o
 * el identificador de un objeto del catalogo.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const lee = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

const fuentes = lee("'apps/shell/src/**' 'apps/shell/app/**'").filter((f) => /\.tsx?$/.test(f));
const pruebas = lee("'apps/shell/e2e/*.ts'");

/** Lo que los componentes pueden producir. */
const literales = new Set<string>(objectRegistry.list().map((o) => o.objectId));
const prefijos = new Set<string>();
for (const ruta of fuentes) {
  const fuente = readFileSync(`${raiz}/${ruta}`, 'utf8');
  for (const m of fuente.matchAll(/(?:data-testid|prueba)\s*[=:]\s*\{?["'`]([\w-]+)["'`]/g)) {
    literales.add(m[1] as string);
  }
  // `data-testid={`add-${objectId}`}` y el testid que viaja como argumento de una funcion.
  for (const m of fuente.matchAll(/`([\w-]*-)\$\{/g)) prefijos.add(m[1] as string);
}

/** Lo que las pruebas piden. */
const pedidos = new Map<string, Set<string>>();
for (const ruta of pruebas) {
  const fuente = readFileSync(`${raiz}/${ruta}`, 'utf8');
  const re = /getByTestId\(\s*['"]([\w-]+)['"]\s*\)|\[data-testid\^?=["']([\w-]+)["']/g;
  for (const m of fuente.matchAll(re)) {
    const id = (m[1] ?? m[2]) as string;
    if (!pedidos.has(id)) pedidos.set(id, new Set());
    (pedidos.get(id) as Set<string>).add(ruta);
  }
}

describe('identificadores de prueba', () => {
  it('hay componentes y pruebas que comparar', () => {
    expect(literales.size).toBeGreaterThan(100);
    expect(pedidos.size).toBeGreaterThan(100);
  });

  it('cada testid que una prueba pide lo escribe algun componente', () => {
    const huerfanos = [...pedidos.keys()]
      .filter(
        (id) =>
          !literales.has(id) &&
          // Un prefijo casa en los dos sentidos: la prueba puede pedir el prefijo entero
          // (`matrix-collapse-x`) o quedarse en el tronco (`[data-testid^="block"]`).
          ![...prefijos].some((p) => id.startsWith(p) || p.startsWith(id)),
      )
      .map((id) => `${id} <- ${[...(pedidos.get(id) as Set<string>)].join(', ')}`);

    expect(huerfanos.sort()).toEqual([]);
  });
});
