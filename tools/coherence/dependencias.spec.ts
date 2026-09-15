import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El candado de dependencias, contra los paquetes que de verdad hay.
 *
 * `npm ci` no instala si `package-lock.json` y los `package.json` no dicen lo mismo: falla en
 * seco con «can only install packages when your package.json and package-lock.json are in sync».
 * Y falla ANTES de que exista un solo binario, asi que ninguna de las demas verificaciones llega
 * a correr para avisarlo — ni el typecheck, ni el lint, ni las pruebas: todo lo que hay despues
 * necesita `node_modules`, y no lo hay.
 *
 * Aqui paso: el renombrado al ingles llamo `@app/sample-module` a lo que el candado seguia
 * conociendo como `@app/modulo-ejemplo`. En esta maquina nadie se entero porque `node_modules`
 * venia de antes y `npm install` no se queja de lo que `npm ci` rechaza; quien clono en limpio se
 * choco de frente y sin nada instalado con lo que investigarlo.
 *
 * La comprobacion lee los dos archivos y compara nombres. No hace falta npm.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

interface Candado {
  packages: Record<string, { name?: string }>;
}

const candado = JSON.parse(readFileSync(join(raiz, 'package-lock.json'), 'utf8')) as Candado;

/** Las carpetas de este repositorio que son un paquete, sin las de `node_modules`. */
const espacios = listar("'*package.json'")
  .map(dirname)
  .filter((carpeta) => carpeta !== '.' && !carpeta.includes('node_modules'));

describe('el candado de dependencias dice lo que el repositorio es', () => {
  it('hay espacios de trabajo que revisar', () => {
    expect(espacios.length).toBeGreaterThan(5);
  });

  it('cada paquete del repositorio esta en el candado, con SU nombre', () => {
    const desajustados = espacios.flatMap((carpeta) => {
      const propio = (
        JSON.parse(readFileSync(join(raiz, carpeta, 'package.json'), 'utf8')) as { name?: string }
      ).name;
      const anotado = candado.packages[carpeta];

      if (!anotado) return [`${carpeta}: no esta en el candado`];
      if (anotado.name !== propio) {
        return [`${carpeta}: el candado lo llama '${anotado.name}' y el paquete se llama '${propio}'`];
      }
      return [];
    });

    expect(desajustados).toEqual([]);
  });

  it('el candado no anota paquetes que ya no existen', () => {
    // Al reves tambien duele, y de la misma forma: `npm ci` compara los dos conjuntos.
    const reales = new Set(espacios);
    const fantasmas = Object.keys(candado.packages).filter(
      (clave) => clave !== '' && !clave.startsWith('node_modules/') && !reales.has(clave),
    );

    expect(fantasmas).toEqual([]);
  });
});
