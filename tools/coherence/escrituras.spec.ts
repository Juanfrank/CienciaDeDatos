import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Toda escritura del cliente pasa por `pedir` — apartado 2.16.
 *
 * `pedir` es donde se pone el token anti-CSRF. Una escritura con `fetch` a pelo sale sin token y
 * el servidor la rechaza con un 403, pero eso NO se ve al escribir el codigo: se ve en produccion,
 * en la pantalla de alguien que pulsa un boton que no hace nada. El compilador no lo puede ver
 * —las dos funciones existen y las dos devuelven una respuesta— y una revision tampoco, porque lo
 * que hay que notar es la AUSENCIA de algo.
 *
 * Asi que se mira aqui. La regla es de las que no tienen matiz: si escribe, va por `pedir`.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

/**
 * `pedir.ts` es el unico que puede llamar a `fetch`, porque es el que lo envuelve.
 *
 * Y las pruebas de navegador quedan fuera: no corren en el navegador de la aplicacion, usan el
 * cliente de Playwright y su token se pone en la sesion de prueba.
 */
const EL_ENVOLTORIO = 'apps/shell/src/components/pedir.ts';

const fuentes = listar("'apps/shell/src/**' 'apps/shell/app/**'").filter(
  (f) => /\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f) && f !== EL_ENVOLTORIO,
);

/** Una llamada a `fetch`. El metodo se declara dentro de sus argumentos. */
const LLAMADAS = /\bfetch\(/g;
const INSEGURO = /method:\s*'(POST|PUT|PATCH|DELETE)'/;

/**
 * Los argumentos de la llamada, contando parentesis.
 *
 * Mirar los N caracteres siguientes es lo evidente y esta mal: `fetch('/api/bookmarks')` es una
 * LECTURA, y a tres lineas de ahi hay una escritura cuyo `method: 'POST'` cae dentro de la
 * ventana. La guarda senalaba la lectura y no la escritura. Contar parentesis no tiene ese
 * problema y no cuesta mas.
 */
function argumentosDe(fuente: string, desde: number): string {
  let profundidad = 0;
  for (let i = desde; i < fuente.length; i += 1) {
    const c = fuente[i];
    if (c === '(') profundidad += 1;
    else if (c === ')') {
      profundidad -= 1;
      if (profundidad === 0) return fuente.slice(desde, i + 1);
    }
  }
  return fuente.slice(desde);
}

describe('las escrituras del cliente (2.16)', () => {
  it('ninguna escribe con `fetch` a pelo: el token vive en `pedir`', () => {
    const culpables: string[] = [];

    for (const ruta of fuentes) {
      const fuente = readFileSync(`${raiz}/${ruta}`, 'utf8');
      for (const llamada of fuente.matchAll(LLAMADAS)) {
        if (!INSEGURO.test(argumentosDe(fuente, llamada.index))) continue;
        const linea = fuente.slice(0, llamada.index).split('\n').length;
        culpables.push(`${ruta}:${linea}`);
      }
    }

    expect(culpables, `escrituras sin token:\n  ${culpables.join('\n  ')}`).toEqual([]);
  });

  it('`pedir` pone la cabecera, y solo en lo que escribe', () => {
    const envoltorio = readFileSync(`${raiz}/${EL_ENVOLTORIO}`, 'utf8');

    expect(envoltorio).toContain('CSRF_HEADER');
    // Una lectura no lleva token: ponerlo en todas no hace dano pero deja de decir lo que hace.
    expect(envoltorio).toContain('SEGUROS');
  });
});
