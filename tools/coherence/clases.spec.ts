import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { clasesDefinidas, clasesEscritas, leer } from './clases.mjs';

/**
 * Las clases de CSS, por los dos sentidos — apartado 2.14.
 *
 * Las guardas de esta carpeta atan los `data-*`, los identificadores de prueba, las rutas y los
 * campos del cable. Faltaba la de los nombres de CLASE, y falta justamente donde mas duele: un
 * selector que no casa no protesta. No lo caza el tipo, ni el lint, ni el navegador — la pagina
 * se dibuja sin el estilo y no pasa nada visible hasta que alguien la mira con atencion.
 *
 * Los dos sentidos son dos fallos distintos:
 *
 *   - El TSX escribe una clase que NINGUNA regla estiliza. Paso de verdad: los botones de
 *     publicar y devolver salieron con `button-primario` y `button-secundario`, que no existen
 *     —las de verdad son `pastilla` y `boton-contorno`—, y la pagina se dibujo con los botones
 *     grises del navegador sin que nada fallara.
 *   - El CSS define una regla que NINGUN componente escribe. Eso es CSS muerto: no rompe nada,
 *     pero se lee, se mantiene y se copia.
 *
 * TRINQUETE Y NO PUERTA, por ahora. Los dos sentidos nacen con deuda —diecinueve clases sin regla
 * y treinta y cuatro reglas sin clase—, y un trinquete que nace rojo no lo mira nadie: se salta la
 * primera vez y se borra la segunda. Los numeros solo pueden bajar; quien limpie una baja el tope
 * en el mismo commit, igual que en 2.10, que asi llego a cero.
 *
 * De las reglas muertas ya se fueron once en esta misma tanda: los alias `md-*` de la escala
 * tipografica, que encabezaban una lista de selectores sin aportar nada —`.md-display-small,
 * .vacio h1, .kpi__value { … }`—. Quitar el alias no cambia un pixel, porque el estilo lo llevan
 * los otros selectores, y por eso se podian quitar de golpe. Las que quedan tienen bloque propio
 * y hay que mirar cada una: eso es la siguiente tanda, no esta.
 *
 * Lo que hizo posible escribir esto es `clases.mts`, que entiende una plantilla. Un extractor
 * ingenuo saca de `className={`x ${cond ? 'a' : 'b'}`}` las palabras `cond`, `a` y `b` como si
 * fueran clases, y una guarda con falsos positivos termina con alguien relajandola hasta que no
 * comprueba nada. Sus casos estan probados abajo, uno a uno.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

const componentes = listar(
  "'apps/shell/src/**/*.tsx' 'apps/shell/app/**/*.tsx' 'packages/ui-components/src/**/*.tsx'",
).filter((f) => !/\.spec\./.test(f));

const hojas = listar("'*.css'");

/** Los topes de hoy. Una foto, no un objetivo: solo pueden bajar. */
const TOPE_SIN_REGLA = 19;
const TOPE_SIN_TSX = 34;

const escritas = new Map<string, string>();
for (const ruta of componentes) {
  for (const clase of clasesEscritas(leer(`${raiz}/${ruta}`))) {
    if (!escritas.has(clase)) escritas.set(clase, ruta);
  }
}

const definidas = new Set<string>();
for (const ruta of hojas) {
  for (const clase of clasesDefinidas(leer(`${raiz}/${ruta}`))) definidas.add(clase);
}

describe('los nombres de clase casan por los dos lados (2.14)', () => {
  it('hay clases que comprobar en los dos lados', () => {
    expect(escritas.size).toBeGreaterThan(200);
    expect(definidas.size).toBeGreaterThan(200);
  });

  it(`las clases que el TSX escribe sin regla no pasan de ${TOPE_SIN_REGLA}`, () => {
    const sinRegla = [...escritas.entries()]
      .filter(([clase]) => !definidas.has(clase))
      .map(([clase, ruta]) => `${clase} (${ruta})`)
      .sort();

    // Con el archivo: una clase sin regla no dice nada si no se sabe quien la escribe.
    expect(sinRegla.length, `sin regla:\n  ${sinRegla.join('\n  ')}`).toBeLessThanOrEqual(
      TOPE_SIN_REGLA,
    );
  });

  it(`las reglas que ningun componente escribe no pasan de ${TOPE_SIN_TSX}`, () => {
    const muertas = [...definidas].filter((clase) => !escritas.has(clase)).sort();

    expect(muertas.length, `CSS muerto:\n  ${muertas.join(', ')}`).toBeLessThanOrEqual(
      TOPE_SIN_TSX,
    );
  });
});

/**
 * El extractor, caso a caso.
 *
 * Se prueba aparte y con ejemplos pequenos porque es lo que decide si la guarda de arriba sirve.
 * Cada uno de estos casos es un falso positivo que se vio de verdad al medir el repositorio.
 */
describe('el extractor entiende una plantilla', () => {
  it('la cadena simple son clases, todas', () => {
    expect([...clasesEscritas('<p className="a b" />')]).toEqual(['a', 'b']);
  });

  it('en una plantilla, lo de fuera de ${} son clases y lo de dentro no', () => {
    const fuente = "<p className={`base ${activo ? 'es-activo' : ''} fin`} />";
    // `activo` es una variable, no una clase: es el falso positivo que impedia escribir la guarda.
    expect([...clasesEscritas(fuente)].sort()).toEqual(['base', 'es-activo', 'fin']);
  });

  it('una plantilla DENTRO de otra no corta la lectura', () => {
    // `[^`]*` se para en la comilla de dentro y da la clase de fuera por no escrita, que es como
    // una guarda acusa de CSS muerto a una regla viva.
    const fuente = '<a className={`tree__link ${activo ? `es-${modo}` : ""}`} />';
    expect([...clasesEscritas(fuente)]).toContain('tree__link');
  });

  it('el literal con el que se COMPARA no es una clase', () => {
    const fuente = `<td className={typeof cell === 'number' ? 'is-number' : ''} />`;
    expect([...clasesEscritas(fuente)]).toEqual(['is-number']);
  });

  it('un prefijo armado a trozos no se cuenta', () => {
    // `navegador--${tipo}` no se puede resolver desde aqui, y contar `navegador--` seria acusar
    // a una clase que si existe.
    expect([...clasesEscritas('<nav className={`navegador--${tipo}`} />')]).toEqual([]);
  });

  it('una expresion que no se puede leer no aporta nada, en vez de aportar basura', () => {
    expect([...clasesEscritas('<p className={estilos[tipo]} />')]).toEqual([]);
  });

  it('del CSS se leen los SELECTORES, no los decimales de una medida', () => {
    const css = '.tarjeta > .titulo { margin: 1.5rem; flex: 1.25; }';
    expect([...clasesDefinidas(css)].sort()).toEqual(['tarjeta', 'titulo']);
  });

  it('y no se lee lo que esta comentado', () => {
    expect([...clasesDefinidas('/* .vieja { color: red; } */ .nueva { color: blue; }')]).toEqual([
      'nueva',
    ]);
  });
});
