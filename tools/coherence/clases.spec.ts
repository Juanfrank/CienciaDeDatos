import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { clasesDefinidas, clasesEscritas, leer, prefijosEscritos } from './clases.mjs';

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
 * **PUERTA, y no trinquete.** Nacio con deuda medida —19 clases sin regla y 34 reglas sin
 * componente— y se limpio entera en la tanda siguiente, asi que los dos numeros son CERO y lo que
 * entra en rojo es lo que se acaba de escribir. Un trinquete solo vale mientras hay deuda; con
 * deuda cero es una puerta, que es lo que se queria desde el principio.
 *
 * Al limpiar aparecieron tres fallos de verdad, que es el argumento entero a favor de la guarda:
 *
 *   - `object__addon`, el boton de ampliar de un contenedor, no tenia regla: se dibujaba como el
 *     boton gris del navegador dentro de la cabecera de la tarjeta.
 *   - `field`, en dos dialogos de administracion, donde la clase de verdad es `form__field`.
 *   - `form__check`, la fila de una casilla, escrita en seis sitios y sin ninguna regla: el
 *     `<label>` caia en `display: inline` y el rotulo se partia por debajo del cuadrito.
 *
 * Las demas eran ganchos sin estilo, y quitarlos no cambia un pixel: una clase sin regla no pinta
 * nada por definicion. De las reglas muertas se fueron primero once alias `md-*` que solo
 * encabezaban listas de selectores, y despues las 34 con bloque propio: el editor de antes de
 * F5.11, el arbol de antes de F5.43, las tarjetas de equipo de antes de F6.4, la leyenda que hoy
 * dibuja ECharts.
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

const escritas = new Map<string, string>();
const prefijos = new Set<string>();
for (const ruta of componentes) {
  const fuente = leer(`${raiz}/${ruta}`);
  for (const clase of clasesEscritas(fuente)) {
    if (!escritas.has(clase)) escritas.set(clase, ruta);
  }
  for (const prefijo of prefijosEscritos(fuente)) prefijos.add(prefijo);
}

const definidas = new Set<string>();
for (const ruta of hojas) {
  for (const clase of clasesDefinidas(leer(`${raiz}/${ruta}`))) definidas.add(clase);
}

/** Lo que se arma con una variable: `navegador--${tipo}` escribe `navegador--pestanas-abajo`. */
const laEscribeUnaPlantilla = (clase: string) =>
  [...prefijos].some((p) => clase.startsWith(p) && clase !== p);

describe('los nombres de clase casan por los dos lados (2.14)', () => {
  it('hay clases que comprobar en los dos lados', () => {
    expect(escritas.size).toBeGreaterThan(200);
    expect(definidas.size).toBeGreaterThan(200);
  });

  it('toda clase que el TSX escribe tiene una regla que la estiliza', () => {
    const sinRegla = [...escritas.entries()]
      .filter(([clase]) => !definidas.has(clase))
      .map(([clase, ruta]) => `${clase} (${ruta})`)
      .sort();

    // Con el archivo: una clase sin regla no dice nada si no se sabe quien la escribe.
    expect(
      sinRegla,
      'esa clase no la estiliza nadie: la pagina se dibuja sin ella y nada protesta.\n' +
        'O es un nombre equivocado —`button-primario` por `pastilla`— o sobra en el marcado.\n',
    ).toEqual([]);
  });

  it('toda regla del CSS la escribe algun componente', () => {
    const muertas = [...definidas]
      .filter((clase) => !escritas.has(clase) && !laEscribeUnaPlantilla(clase))
      .sort();

    expect(
      muertas,
      'CSS muerto: una regla que ningun componente escribe no rompe nada, pero se lee,\n' +
        'se mantiene y se copia. Si la escribe una plantilla, el prefijo tiene que verse\n' +
        'en el `className` para que esta guarda pueda saberlo.\n',
    ).toEqual([]);
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

/**
 * El prefijo, que es lo mismo mirado desde el otro lado.
 *
 * `clasesEscritas` NO cuenta `navegador--`, y hace bien. Pero entonces las reglas
 * `.navegador--pestanas-abajo` y sus tres hermanas quedaban como CSS muerto, y un numero que dice
 * «borra esto» estando vivo es peor que un numero que se queda corto.
 */
describe('el prefijo de una clase armada con una variable', () => {
  it('se saca aparte, con su trozo fijo', () => {
    expect([...prefijosEscritos('<nav className={`navegador navegador--${tipo}`} />')]).toEqual([
      'navegador--',
    ]);
  });

  it('y no se saca de lo que no lleva variable', () => {
    expect([...prefijosEscritos('<p className={`a b`} />')]).toEqual([]);
  });

  it('un hueco que ocupa la clase entera no es prefijo de nada', () => {
    // `${todo}` taparia la hoja completa: cualquier regla empezaria por la cadena vacia.
    expect([...prefijosEscritos('<p className={`${todo}`} />')]).toEqual([]);
  });

  it('y el de verdad cubre la clase que la plantilla llega a escribir', () => {
    const cubre = [...prefijosEscritos('<nav className={`navegador--${tipo}`} />')].some((p) =>
      'navegador--pestanas-abajo'.startsWith(p),
    );
    expect(cubre).toBe(true);
  });
});
