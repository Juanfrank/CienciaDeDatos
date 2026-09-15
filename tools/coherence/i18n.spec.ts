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
 * el tope en el mismo commit. Empezo en 322 con 53 claves; va por 191, y las cinco pantallas que
 * mas acumulaban —el panel de formato, los ajustes de objeto, el panel lateral, la lista de
 * modulos y la de acceso— ya no estan entre las peores.
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
const TOPE = 167;

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

/**
 * Las claves de catalogo que se arman con una plantilla.
 *
 * `t('accion.guardar')` es una cadena literal y el tipo `MessageKey` la comprueba. `t(`familia.
 * ${family}`)` no: no hay tipo que cubra una plantilla, asi que el sitio lleva un `as MessageKey`
 * y con el se apaga la unica comprobacion que habia.
 *
 * Por ahi se colo el renombrado de las claves al ingles. El diccionario de migracion sustituye
 * SIEMPRE dentro de comillas y clave a clave: `familia.comparacion` -> `family.comparison` en el
 * catalogo, sin nada que tocar el prefijo `familia.` escrito dentro de la plantilla. Compilaba,
 * el lint no decia nada, y la paleta del editor dibujaba «familia.comparison» como encabezado de
 * cada familia — la llave cruda a la vista, en la pantalla que mas se usa.
 *
 * Se comprueba lo unico que la plantilla deja fijo: el PREFIJO. Si ninguna clave del catalogo
 * empieza por el, no hay expansion que pueda existir y la llave acabara en pantalla.
 */
describe('claves de catalogo armadas con plantilla', () => {
  const catalogo = readFileSync(`${raiz}/packages/i18n/src/catalog/es.ts`, 'utf8');
  const claves = [...catalogo.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1] as string);

  const fuentes = listar(
    "'apps/shell/src/**' 'apps/shell/app/**' 'packages/ui-components/src/**'",
  ).filter((f) => /\.tsx?$/.test(f) && !/\.spec\./.test(f));

  /** `t(`family.${x}`)` -> `family.` */
  const PLANTILLA = /\bt\(\s*`([^`$]*\.)\$\{/g;

  const prefijos = fuentes.flatMap((f) =>
    [...readFileSync(`${raiz}/${f}`, 'utf8').matchAll(PLANTILLA)].map(
      (m) => [f, m[1] as string] as const,
    ),
  );

  it('hay alguna plantilla que comprobar', () => {
    expect(prefijos.length).toBeGreaterThan(0);
  });

  it('todo prefijo de plantilla existe en el catalogo', () => {
    const huerfanos = prefijos
      .filter(([, prefijo]) => !claves.some((c) => c.startsWith(prefijo)))
      .map(([f, prefijo]) => `${f}: ${prefijo}*`);
    expect([...new Set(huerfanos)].sort()).toEqual([]);
  });
});

/**
 * Cada capacidad de la matriz de permisos, con su rotulo.
 *
 * La matriz de 4.10.1 se dibuja recorriendo `CAPABILITIES` y pidiendo `t('cap.<capacidad>')`. Es
 * otra clave armada con plantilla, asi que el tipo no la cubre; pero aqui se puede comprobar algo
 * mas fuerte que el prefijo, porque las capacidades son una lista CERRADA y conocida.
 *
 * Sin esto, anadir una capacidad a la matriz —que es una linea— la haria aparecer en el panel
 * dibujada como `cap.exportar-lo-que-sea`, la llave cruda, en la tabla que explica quien puede
 * que. Y al reves: quitarla dejaria el rotulo huerfano en el catalogo para siempre.
 */
describe('la matriz de permisos tiene rotulo para cada capacidad', () => {
  const permisos = readFileSync(`${raiz}/packages/access-control/src/permissions.ts`, 'utf8');
  const catalogo = readFileSync(`${raiz}/packages/i18n/src/catalog/es.ts`, 'utf8');

  /** Las capacidades salen del TIPO, que es la unica lista que no puede quedarse corta. */
  const declarado = /export type Capability =([\s\S]*?);/.exec(permisos)?.[1] ?? '';
  const capacidades = [...declarado.matchAll(/'([a-z-]+)'/g)].map((m) => m[1] as string);
  const rotulos = new Set(
    [...catalogo.matchAll(/^\s*'cap\.([a-z-]+)':/gm)].map((m) => m[1] as string),
  );

  it('hay capacidades que comprobar', () => {
    expect(capacidades.length).toBeGreaterThan(8);
  });

  it('ninguna capacidad se dibujaria con la llave a la vista', () => {
    expect(capacidades.filter((c) => !rotulos.has(c)).sort()).toEqual([]);
  });

  it('ningun rotulo se queda huerfano de una capacidad que ya no existe', () => {
    expect([...rotulos].filter((r) => !capacidades.includes(r)).sort()).toEqual([]);
  });
});
