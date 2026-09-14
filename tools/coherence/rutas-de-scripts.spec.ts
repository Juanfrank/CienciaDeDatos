import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Las rutas del repositorio que se citan FUERA del codigo y fuera de los markdown.
 *
 * Hay una guarda para las rutas citadas en los `.md` y otra para las URL del enrutador. Entre las
 * dos queda un hueco por el que se cuela lo que mas duele: los scripts y la configuracion.
 *
 * El renombrado al ingles lo encontro. `tools/verify-module-boundaries.sh` apuntaba al fixture
 * negativo por su ruta escrita a mano —`apps/modules/modulo-ejemplo/src/__boundary-fixture__/`—,
 * la carpeta paso a `sample-module`, y el script siguio ahi. No dejo de compilar porque un script
 * de bash no compila; el lint no lo mira; y `nx` contesto en verde durante dos ejecuciones enteras
 * porque el resultado estaba EN CACHE. Cuando la cache se invalido, el fallo salio como
 * «el lint fallo, pero no por @nx/enforce-module-boundaries», que no menciona ninguna ruta.
 *
 * La comprobacion que faltaba es la mas simple: lo que se nombra, ¿existe?
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

/** Una ruta del repositorio: empieza por una de las carpetas de primer nivel. */
const RUTA = /\b((?:apps|packages|tools|docs|infra)\/[A-Za-z0-9_./[\]()-]*[A-Za-z0-9_\])])/g;

describe('rutas citadas en scripts y configuracion', () => {
  /*
   * Solo lo que una persona ESCRIBE. `package-lock.json` y `.claude/depgraph.json` los genera una
   * herramienta a partir del arbol, asi que quedarse atras es lo normal en ellos y no dice nada
   * sobre si algo esta roto: regenerarlos los arregla. Meterlos aqui convertiria la guarda en un
   * recordatorio de regenerar caches, que es como se acaba desactivando una guarda.
   */
  const GENERADOS = ['package-lock.json', '.claude/depgraph.json'];
  // Con `'tools/**/*.sh'` no salia ninguno: el `**` de git exige al menos una carpeta por medio,
  // y los dos scripts cuelgan directamente de `tools/`. Por eso se pide la extension sin anclar
  // la carpeta.
  const grupos = {
    scripts: listar("'*.sh'"),
    configuracion: listar("'*.json'").filter((f) => !GENERADOS.includes(f)),
    flujos: listar("'*.yml' '*.yaml'"),
  };
  const archivos = Object.values(grupos).flat();

  /*
   * Se cuenta CADA lista, no el total.
   *
   * `AGENTS.md` ya avisa de que una lista vacia sale verde siempre, y aun asi se colo otra vez:
   * la primera version contaba `archivos.length > 10`, los `.json` solos pasaban de diez, y los
   * cero scripts de `tools/**` no se notaron. La guarda estuvo en verde sin llegar a abrir el
   * unico archivo por el que se escribio.
   */
  it.each(Object.entries(grupos))('hay %s que revisar', (_nombre, lista) => {
    expect(lista.length).toBeGreaterThan(0);
  });

  it('toda ruta del repositorio que nombran existe', () => {
    const rotas: string[] = [];
    for (const archivo of archivos) {
      const lineas = readFileSync(`${raiz}/${archivo}`, 'utf8').split('\n');
      lineas.forEach((linea, i) => {
        // Un comodin no es una ruta: `packages/**/src` no existe como carpeta y no deberia.
        if (linea.includes('*')) return;
        for (const m of linea.matchAll(RUTA)) {
          const cita = m[1] as string;
          // `[slug]` y compania son segmentos dinamicos reales, asi que la ruta existe tal cual.
          if (existsSync(`${raiz}/${cita}`)) continue;
          rotas.push(`${archivo}:${i + 1}: ${cita}`);
        }
      });
    }
    expect([...new Set(rotas)].sort()).toEqual([]);
  });
});
