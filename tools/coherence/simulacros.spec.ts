import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Quien sustituye un MODULO tiene que correr con registro nuevo.
 *
 * Las pruebas de unidad corren con los procesos reutilizados entre archivos (`isolate: false`):
 * doce segundos pasan a cuatro porque el arbol de modulos se evalua una vez por proceso en vez de
 * una vez por archivo. Eso choca de frente con `vi.mock`, que intercambia un modulo ANTES de que
 * se evalue el arbol que lo usa: si otro archivo del mismo proceso ya lo evaluo, el simulacro
 * llega tarde y el codigo bajo prueba se queda con el modulo de verdad.
 *
 * No es teorico. Con `isolate: false` a secas, `auth.spec.ts` fallaba en tres de cada cinco
 * barajadas: contaba CERO llamadas a `verify` donde espera una por rama. Por eso los archivos que
 * simulan corren en su propio grupo, con aislamiento, y esta guarda es la que impide que la lista
 * se quede vieja — que es lo que pasaria si dependiera de que alguien se acuerde.
 *
 * La lista se lee DEL archivo de configuracion, no de una copia aqui: una guarda que compara una
 * lista consigo misma esta siempre en verde. Se lee como texto y no importando el modulo porque
 * `tools/coherence` no puede importar de fuera de su proyecto —lo prohibe el limite de
 * dependencias—, que es lo mismo que hacen las demas guardas de esta carpeta con el codigo que
 * miran. Y se comprueba que la lectura ENCONTRO algo: si alguien renombra la constante, lo que se
 * leeria es una lista vacia, y una lista vacia compara bien contra nada.
 *
 * Que un simulacro que llega tarde ROMPA la prueba es suerte, no diseno: pasa porque `auth.spec.ts`
 * afirma sobre las llamadas del doble. Una prueba que solo sustituyera para «no tocar disco» se
 * quedaria verde y muda, y de ese fallo no avisaria nadie. Esta guarda es lo que cubre ese caso.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const pruebas = execSync(`git -C ${raiz} ls-files '*.spec.ts' '*.spec.tsx'`)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

/** `vi.mock` y `vi.doMock`, que es el mismo problema disparado a mano. */
const SIMULA = /\bvi\.(do)?mock\s*\(/i;

const ESTA_GUARDA = 'tools/coherence/simulacros.spec.ts';

/** La lista declarada en `vitest.config.mts`, leida de ahi. */
const declarados = (): string[] => {
  const config = readFileSync(`${raiz}/vitest.config.mts`, 'utf8');
  const lista = /export const CON_SIMULACRO = \[([^\]]*)\]/.exec(config)?.[1];
  if (lista === undefined) throw new Error('`CON_SIMULACRO` no esta en vitest.config.mts');
  return [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
};

describe('los simulacros de modulo y el aislamiento (rendimiento de la suite)', () => {
  it('hay pruebas que revisar, y la lista se leyo de verdad', () => {
    expect(pruebas.length).toBeGreaterThan(40);
    expect(declarados().length).toBeGreaterThan(0);
  });

  it('todo archivo que sustituye un modulo esta declarado en `CON_SIMULACRO`', () => {
    const simulan = pruebas.filter(
      (ruta) => ruta !== ESTA_GUARDA && SIMULA.test(readFileSync(`${raiz}/${ruta}`, 'utf8')),
    );

    expect(
      simulan.sort(),
      'estos archivos usan `vi.mock` y corren con el registro compartido, donde el simulacro\n' +
        'puede llegar tarde y no aplicarse. Anadelos a `CON_SIMULACRO` en `vitest.config.mts`.\n',
    ).toEqual([...declarados()].sort());
  });

  it('y ninguna entrada de la lista sobra', () => {
    // Una entrada de mas es un archivo que paga aislamiento sin necesitarlo, y una pista falsa
    // para quien lea la lista buscando por que esta ahi.
    const sinSimulacro = declarados().filter(
      (ruta) => !SIMULA.test(readFileSync(`${raiz}/${ruta}`, 'utf8')),
    );
    expect(sinSimulacro).toEqual([]);
  });
});
