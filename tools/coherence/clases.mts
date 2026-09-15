/**
 * Las clases que el TSX escribe y las que el CSS define — apartado 2.14.
 *
 * Es el extractor, aparte de su guarda, porque la guarda se lee en dos minutos y esto no: lo que
 * cuesta aqui es entender una PLANTILLA, y mezclarlo con las aserciones haria ilegibles las dos
 * cosas.
 *
 * El problema que resuelve, dicho con el caso que lo motivo: los botones de publicar y devolver
 * salieron con `button-primario` y `button-secundario`, que no existen —las de verdad son
 * `pastilla` y `boton-contorno`—, y la pagina se dibujo con botones grises del navegador sin que
 * nada fallara. No lo caza el tipo, ni el lint, ni el navegador: un selector que no casa no
 * protesta, se queda mudo.
 *
 * Y el motivo por el que la guarda no existia: un extractor ingenuo saca de
 * `className={`x ${cond ? 'a' : 'b'}`}` las palabras `cond`, `a` y `b` como si fueran clases, y
 * una guarda con falsos positivos termina con alguien relajandola hasta que no comprueba nada.
 */
import { readFileSync } from 'node:fs';

/**
 * Las clases que un `className` escribe, entendiendo la plantilla.
 *
 * La regla es una sola y de ella sale todo lo demas: dentro de una plantilla, lo que esta FUERA
 * de `${…}` es una clase y lo que esta DENTRO es codigo — salvo los literales de cadena, que
 * dentro de `${…}` son justamente las dos ramas de un ternario y si son clases.
 *
 *   className="a b"                        -> a, b
 *   className={`a ${x ? 'b' : 'c'} d`}     -> a, b, c, d     (no `x`)
 *   className={estilos[tipo]}              -> nada           (no se puede saber)
 */
export function clasesEscritas(fuente: string): Set<string> {
  const clases = new Set<string>();
  const anadir = (texto: string) => {
    for (const c of texto.split(/\s+/)) if (esNombreDeClase(c)) clases.add(c);
  };

  // `className="…"`, el caso simple: la cadena entera son clases.
  for (const m of fuente.matchAll(/className="([^"]*)"/g)) anadir(m[1] ?? '');

  // `className={…}`: la expresion se recorta CONTANDO llaves, no con una expresion regular.
  for (const m of fuente.matchAll(/className=\{/g)) {
    anadirDeExpresion(expresionDesde(fuente, m.index + m[0].length), anadir);
  }

  return clases;
}

/**
 * Los PREFIJOS de las clases que se arman con una variable.
 *
 * `` className={`navegador navegador--${navegador.tipo}`} `` escribe `navegador--pestanas-abajo`
 * el dia que el tipo sea ese, y ningun extractor puede saberlo desde aqui. `clasesEscritas` hace
 * lo correcto y no la cuenta —contar `navegador--` acusaria a una clase que si existe—, pero eso
 * deja el OTRO sentido mintiendo: las cuatro reglas `.navegador--…` quedaban como CSS muerto, y
 * alguien que se fie del numero borra una regla viva. Peor que un falso positivo que se ve: uno
 * que dice que borres.
 *
 * Asi que el prefijo se saca aparte y solo sirve para eso: una regla definida que empieza por un
 * prefijo escrito NO se cuenta como muerta. Es deliberadamente generoso en ese unico sentido.
 */
export function prefijosEscritos(fuente: string): Set<string> {
  const prefijos = new Set<string>();
  for (const m of fuente.matchAll(/className=\{/g)) {
    const expresion = expresionDesde(fuente, m.index + m[0].length);
    for (const plantilla of expresion.matchAll(/`([^`]*)`/g)) {
      for (const trozo of (plantilla[1] ?? '').split(/\s+/)) {
        const fijo = trozo.split('${')[0] ?? '';
        // Un prefijo tiene que serlo: `${x}` entero no acota nada y taparia la hoja completa.
        if (trozo.includes('${') && /^[a-zA-Z_-][\w-]*$/.test(fijo)) prefijos.add(fijo);
      }
    }
  }
  return prefijos;
}

/**
 * La expresion de un `className={…}`, del `{` a su `}` pareja.
 *
 * Contando llaves y no con una expresion regular, porque las plantillas se ANIDAN:
 * `` `tree__link ${activo ? `es-${modo}` : ''}` `` lleva una plantilla dentro de un hueco de
 * otra, y cualquier `[^`]*` se corta en la primera comilla de dentro. Esa es exactamente la
 * clase de fallo que hace que una guarda diga que una clase viva es CSS muerto.
 */
function expresionDesde(fuente: string, desde: number): string {
  let hondura = 1;
  for (let i = desde; i < fuente.length; i += 1) {
    const c = fuente[i];
    if (c === '{') hondura += 1;
    else if (c === '}') {
      hondura -= 1;
      if (hondura === 0) return fuente.slice(desde, i);
    }
  }
  return fuente.slice(desde);
}

/**
 * Las clases de una expresion de `className`.
 *
 * Lo que esta dentro de una plantilla y FUERA de `${…}` es una clase tal cual. Lo que hay dentro
 * de `${…}` es codigo, y de ahi solo se toman los literales de cadena: son las ramas del ternario
 * —`activo ? 'es-activo' : ''`—, que si acaban en el atributo. El resto son nombres de variable,
 * y contarlos es lo que hundiria la guarda.
 */
function anadirDeExpresion(expresion: string, anadir: (texto: string) => void): void {
  for (const plantilla of expresion.matchAll(/`([^`]*)`/g)) {
    const cuerpo = plantilla[1] ?? '';
    anadir(cuerpo.replace(/\$\{[^}]*\}/g, ' '));
  }
  /*
   * Los literales sueltos: las ramas de un ternario y un `className={'x'}`.
   *
   * Menos los que son OPERANDO de una comparacion. `typeof cell === 'number' ? 'is-number' : ''`
   * lleva dos literales y solo uno es una clase: el otro es con lo que se compara. Contarlo daba
   * `number` y `ok` como clases inexistentes —falsos positivos de los que hunden una guarda—.
   */
  const sinComparados = expresion.replace(/[=!]==?\s*('[^']*'|"[^"]*")/g, ' ');
  for (const literal of sinComparados.matchAll(/'([^']*)'|"([^"]*)"/g)) {
    anadir(literal[1] ?? literal[2] ?? '');
  }
}

/**
 * Un nombre de clase que se puede comprobar.
 *
 * Se descarta lo que no puede ser una clase CSS —lo vacio, lo que empieza por cifra— y tambien
 * las que llevan `${`, que son las armadas a trozos: `objeto--${tipo}` no se puede resolver desde
 * aqui, y contarla daria un falso positivo de los que hunden una guarda.
 */
function esNombreDeClase(texto: string): boolean {
  // Ni termina en guion: `navegador--` es el trozo fijo de `navegador--${tipo}`, que se arma con
  // una variable y no se puede resolver desde aqui.
  return /^[a-zA-Z_-][\w-]*$/.test(texto) && !texto.endsWith('-');
}

/** Las clases que una hoja de estilo DEFINE, de sus selectores. */
export function clasesDefinidas(css: string): Set<string> {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const clases = new Set<string>();
  // Solo la parte de SELECTOR: dentro de un bloque, `.` puede ser un decimal de una medida.
  for (const bloque of sinComentarios.split('}')) {
    const selector = bloque.split('{')[0] ?? '';
    for (const m of selector.matchAll(/\.([a-zA-Z_-][\w-]*)/g)) clases.add(m[1] as string);
  }
  return clases;
}

export const leer = (ruta: string): string => readFileSync(ruta, 'utf8');
