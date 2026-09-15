import { type ColorMode, type ThemeSource } from './material3';
import { type MaterialTheme, materialTheme, tintOf, TINTE_NEUTRO } from './material3Tokens';
import { INSTITUTIONAL_SOURCE, TYPEFACES, type TypefaceId } from './institutionalTheme';

/**
 * Un tema: un nombre y TRES colores de origen — seccion 4.3.
 *
 * Lo que se guarda no son los tokens, son los origenes. Material Design 3 deriva de ellos los
 * cuarenta y tantos tokens de cada modo, y el claro y el oscuro de un tema salen del MISMO origen:
 * por eso un tema no es «el claro» y otro «el oscuro», sino que cada tema tiene los dos. Guardarlos
 * como dos temas sueltos —que es como estaban— permitia que alguien cambiara uno y no el otro, y
 * la aplicacion pasaria a oscuro con colores de otra marca.
 *
 * Tampoco se guarda token a token. Editar uno suelto rompe la relacion de contraste que 4.9 exige,
 * y la pantalla dejaria de poder prometer AA: lo que se elige son los origenes, y el contraste se
 * comprueba sobre lo derivado antes de dejar guardar.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  /** Para que se creo, en una frase. Se lee en la lista de temas. */
  description?: string;
  source: ThemeSource;
  /**
   * De fabrica: viene con la aplicacion y no se borra.
   *
   * Sin un tema que siempre este, borrar el ultimo dejaria la aplicacion sin color —y sin forma de
   * volver a entrar a crear uno, porque el panel tambien se dibuja con el.
   */
  builtIn?: boolean;
  /**
   * Con que letra se escribe. Ausente: la institucional.
   *
   * La tipografia estaba fuera del tema a proposito —«el color se elige, la letra no»— y eso era
   * cierto mientras todos los temas fueran variaciones de la misma norma de marca. Un tema que
   * viene de otra linea grafica trae su letra: es la mitad de lo que lo hace reconocible, y
   * dejarlo fuera da un tema con los colores de uno y la cara de otro.
   *
   * Es un identificador de un conjunto CERRADO, no un nombre de fuente. Ver `TYPEFACES`.
   */
  typeface?: TypefaceId;
  /**
   * De que color es la sombra. Ausente: el negro de la especificacion.
   *
   * `de-marca` la tine con el propio primario del tema. No es un adorno: una sombra negra sobre
   * superficies que tiran a azul se ve gris sucia, y es lo que hace que una pantalla no termine de
   * verse limpia sin que se pueda senalar que falla.
   */
  shadow?: 'neutra' | 'de-marca';
}

/** El tema institucional, el que viene de fabrica. */
export const INSTITUTIONAL_THEME: ThemeDefinition = {
  id: 'institucional',
  name: 'Institucional',
  description: 'La norma de marca del Poder Judicial: azul, rojo de acento y el gris de la portada.',
  source: INSTITUTIONAL_SOURCE,
  builtIn: true,
};

/**
 * La linea grafica del tablero de casos penales, como tema — seccion 4.3.
 *
 * Es la capa VISUAL de esa linea y nada mas: color, letra y sombra. Lo que aquella guia llama
 * componentes —tarjetas de indicador, listas de barras, la dona, la paginacion— no entra, y no por
 * falta de sitio: un tema decide como se VE la aplicacion, no que objetos existen ni como se
 * comportan. Eso vive en el catalogo de objetos, que se versiona y se revisa por su propio camino.
 *
 * Los tres origenes salen de sus tokens:
 *
 * - `primario`, el azul de accion, que es el mismo de la norma institucional.
 * - `acento`, el morado con el que esa linea dibuja las series alternas de un grafico.
 * - `neutro`, su gris azulado, del que salen el fondo de pagina y los bordes.
 *
 * Y `error` se dice aparte porque hace falta: atado al acento, los errores saldrian morados.
 */
export const GRAPHIC_LINE_THEME: ThemeDefinition = {
  id: 'linea-grafica',
  name: 'Linea grafica',
  description:
    'La linea grafica del tablero de casos penales: azul de accion, morado de series, gris azulado, Poppins y sombra con tinte de marca.',
  source: {
    primario: '#0050dd',
    acento: '#7c5cfc',
    neutro: '#5c6580',
    error: '#ef3340',
  },
  typeface: 'poppins',
  shadow: 'de-marca',
  builtIn: true,
};

/** Los temas que vienen con la aplicacion. Ninguno se borra. */
export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [
  INSTITUTIONAL_THEME,
  GRAPHIC_LINE_THEME,
];

/** El tinte de sombra que le toca a un tema. */
const tinteDe = (definicion: ThemeDefinition): string =>
  definicion.shadow === 'de-marca' ? tintOf(definicion.source) : TINTE_NEUTRO;

/** Las dos versiones de un tema, derivadas de su origen. Todo tema tiene las dos. */
export function themeVersions(definicion: ThemeDefinition): Record<ColorMode, MaterialTheme> {
  return { light: themeVersion(definicion, 'light'), dark: themeVersion(definicion, 'dark') };
}

/** Una version concreta. */
export function themeVersion(definicion: ThemeDefinition, mode: ColorMode): MaterialTheme {
  return materialTheme(
    definicion.source,
    mode,
    TYPEFACES[definicion.typeface ?? 'institucional'],
    tinteDe(definicion),
  );
}

/**
 * Los tres roles de origen OBLIGATORIOS, en el orden en que se explican y se editan.
 *
 * `error` no esta aqui a proposito: es opcional —ausente, el error sale del acento— y meterlo en
 * esta lista lo convertiria en un campo mas que la pantalla pide siempre, cuando lo normal es no
 * tener que contestarlo.
 */
export const SOURCE_ROLES = ['primario', 'acento', 'neutro'] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

/** Un color de origen valido: hexadecimal de seis digitos. Es lo que el derivador sabe leer. */
export function sourceColorIs(valor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valor.trim());
}
