import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El texto que se lee en pantalla, contra el catalogo del que deberia salir.
 *
 * `AGENTS.md` lo pone entre las reglas que no se negocian: «el texto visible sale del catalogo,
 * no del componente», y dice que lo garantiza una prueba. No habia tal prueba, y la regla lleva
 * incumpliendose casi entera: 53 claves en el catalogo contra mas de trescientas cadenas escritas
 * dentro de los componentes.
 *
 * El numero solo puede BAJAR. Quien anada una cadena suelta rompe la prueba; quien migre una baja
 * el tope en el mismo commit. Empezo en 322 con 53 claves; va por 222 con 152, y las cuatro
 * pantallas que mas acumulaban —el panel de formato, los ajustes de objeto, el panel lateral y la
 * lista de modulos— ya no estan entre las peores.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

const componentes = listar(
  "'apps/shell/src/**/*.tsx' 'apps/shell/app/**/*.tsx' 'packages/ui-components/src/**/*.tsx'",
).filter((f) => !/\.spec\./.test(f));

/** Prosa de un JSX: lo que hay entre una etiqueta que cierra y otra que abre. */
const PROSA = />\s*([^<>{}\n]{3,})\s*</g;
/** Atributos que una persona lee o escucha, aunque no se dibujen como texto. */
const ATRIBUTO = /(?:aria-label|title|placeholder)="([^"]{3,})"/g;
/** Una palabra de verdad, no un simbolo ni una cifra. */
const PALABRA = /[A-Za-zÀ-ÿ]{3,}/;

/**
 * El tope de hoy.
 *
 * Es una foto, no un objetivo: cada cadena que se migre al catalogo puede bajarlo. Subirlo
 * requiere explicar por que una cadena nueva no puede ir al catalogo.
 */
const TOPE = 222;

function cadenasDe(ruta: string): string[] {
  const fuente = readFileSync(`${raiz}/${ruta}`, 'utf8');
  const prosa = [...fuente.matchAll(PROSA)].map((m) => (m[1] as string).trim());
  const atributos = [...fuente.matchAll(ATRIBUTO)].map((m) => m[1] as string);
  return [...prosa, ...atributos].filter((t) => PALABRA.test(t));
}

describe('el texto visible sale del catalogo', () => {
  const porArchivo = componentes.map((f) => [f, cadenasDe(f).length] as const);
  const total = porArchivo.reduce((suma, [, n]) => suma + n, 0);

  it('hay componentes que revisar', () => {
    expect(componentes.length).toBeGreaterThan(40);
  });

  it('el catalogo existe y tiene los dos idiomas con las mismas claves', () => {
    const claves = (idioma: string) =>
      [...readFileSync(`${raiz}/packages/i18n/src/catalog/${idioma}.ts`, 'utf8').matchAll(
        /^\s*'([^']+)':/gm,
      )].map((m) => m[1]);
    const es = claves('es');
    const en = claves('en');
    expect(es.length).toBeGreaterThan(40);
    expect(en.sort()).toEqual([...es].sort());
  });

  it(`las cadenas sueltas no pasan de ${TOPE}`, () => {
    const peores = [...porArchivo]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([f, n]) => `${f}: ${n}`);
    expect(total, `las que mas acumulan:\n  ${peores.join('\n  ')}`).toBeLessThanOrEqual(TOPE);
  });
});
