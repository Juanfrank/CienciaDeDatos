import { type ColorMode, type ThemeSource } from './material3';
import {
  type MaterialTheme,
  type ShadowShapeId,
  type ShapeScaleId,
  type ThemeStyle,
  type TypeScaleId,
  SHAPE_SCALES,
  TINTE_NEUTRO,
  TYPE_SCALES,
  materialTheme,
  tintOf,
} from './material3Tokens';
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
   * Con que tamanos y pesos se escribe. Ausente: la escala de Material.
   *
   * La letra y su escala son dos cosas distintas y por eso se eligen aparte: Poppins en la escala
   * de Material sigue siendo una aplicacion de Material escrita en Poppins. Lo que hace que una
   * pantalla se reconozca como de otra linea grafica es tanto el tamano de los rotulos y el peso
   * de los titulos como la forma de las letras. Ver `TYPE_SCALES`.
   */
  typeScale?: TypeScaleId;
  /** Con que radios se redondean las esquinas. Ausente: los siete de Material. Ver `SHAPE_SCALES`. */
  cornerRadius?: ShapeScaleId;
  /**
   * Que FORMA tiene la sombra: cuantas capas, con que desenfoque y con que opacidad.
   *
   * Ausente: la de la especificacion. Ver `SHADOW_SHAPES`.
   */
  shadowShape?: ShadowShapeId;
  /**
   * De que color es la sombra. Ausente: el negro de la especificacion.
   *
   * `de-marca` la tine con el propio primario del tema. No es un adorno: una sombra negra sobre
   * superficies que tiran a azul se ve gris sucia, y es lo que hace que una pantalla no termine de
   * verse limpia sin que se pueda senalar que falla.
   */
  shadowTint?: 'neutra' | 'de-marca';
}

/**
 * El tema institucional, el que viene de fabrica.
 *
 * Dice sus cinco ejes de estilo aunque todos sean el valor por omision, y eso es lo que cambio:
 * antes no los decia porque no existian —eran constantes globales que compartian todos los temas—
 * y lo que servia de tema institucional era «lo que quedara en esas constantes». Escritos, este
 * tema es una declaracion completa y no el residuo de otras; y el dia que alguien toque un valor
 * global, tendra que venir aqui a decir que tambien cambia el tema de la institucion.
 */
export const INSTITUTIONAL_THEME: ThemeDefinition = {
  id: 'institucional',
  name: 'Institucional',
  description:
    'La norma de marca del Poder Judicial: azul, rojo de acento y el gris de la portada, ' +
    'en Montserrat y con la escala, los radios y la sombra de Material.',
  source: INSTITUTIONAL_SOURCE,
  typeface: 'institucional',
  typeScale: 'material',
  cornerRadius: 'material',
  shadowShape: 'material',
  shadowTint: 'neutra',
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
 * Y los tres semanticos se dicen aparte porque los tres hacen falta. El rojo, porque atado al
 * acento los errores saldrian morados. El verde y el ambar, porque son los de su seccion
 * «Semantico» y no se parecen a los de respaldo por casualidad: la guia los eligio para convivir
 * con este azul y este morado sin competir con ellos.
 */
export const GRAPHIC_LINE_THEME: ThemeDefinition = {
  id: 'linea-grafica',
  name: 'Linea grafica',
  description:
    'La linea grafica del tablero de casos penales: azul de accion, morado de series, gris ' +
    'azulado, verde y ambar semanticos, Poppins en escala compacta, tres radios y sombra difusa ' +
    'con tinte de marca.',
  source: {
    primario: '#0050dd',
    acento: '#7c5cfc',
    neutro: '#5c6580',
    error: '#ef3340',
    exito: '#128a5e',
    advertencia: '#d97706',
  },
  typeface: 'poppins',
  typeScale: 'compacta',
  cornerRadius: 'tres-radios',
  shadowShape: 'difusa',
  shadowTint: 'de-marca',
  builtIn: true,
};

/** Los temas que vienen con la aplicacion. Ninguno se borra. */
export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [
  INSTITUTIONAL_THEME,
  GRAPHIC_LINE_THEME,
];

/**
 * El estilo de un tema, con lo que no diga resuelto al valor institucional.
 *
 * Es el UNICO sitio donde se decide que significa «ausente», y por eso esta aqui y no repartido
 * entre quienes derivan tokens. Con la resolucion en varios sitios, un tema sin letra podria
 * salir en Montserrat desde una pantalla y en otra cosa desde la exportacion.
 *
 * Depende del modo por la sombra, que en oscuro pierde el tinte de marca. Ver `tintOf`.
 */
export function themeStyle(definicion: ThemeDefinition, mode: ColorMode): ThemeStyle {
  return {
    fonts: TYPEFACES[definicion.typeface ?? 'institucional'],
    typography: TYPE_SCALES[definicion.typeScale ?? 'material'],
    shape: SHAPE_SCALES[definicion.cornerRadius ?? 'material'],
    shadowShape: definicion.shadowShape ?? 'material',
    shadowTint:
      definicion.shadowTint === 'de-marca' ? tintOf(definicion.source, mode) : TINTE_NEUTRO,
  };
}

/** Las dos versiones de un tema, derivadas de su origen. Todo tema tiene las dos. */
export function themeVersions(definicion: ThemeDefinition): Record<ColorMode, MaterialTheme> {
  return { light: themeVersion(definicion, 'light'), dark: themeVersion(definicion, 'dark') };
}

/** Una version concreta. */
export function themeVersion(definicion: ThemeDefinition, mode: ColorMode): MaterialTheme {
  return materialTheme(definicion.source, mode, themeStyle(definicion, mode));
}

/**
 * Los tres roles de origen OBLIGATORIOS, en el orden en que se explican y se editan.
 *
 * Los semanticos no estan aqui a proposito: los tres son opcionales y los tres tienen respaldo,
 * asi que meterlos en esta lista los convertiria en campos que la pantalla exige siempre, cuando
 * lo normal es no tener que contestarlos. Van en `SEMANTIC_ROLES`, que la pantalla ofrece aparte.
 */
export const SOURCE_ROLES = ['primario', 'acento', 'neutro'] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

/**
 * Los tres roles semanticos, opcionales, en el orden en que se leen.
 *
 * Se pueden decir y casi nunca hace falta. `error` sale del acento; el verde y el ambar salen de
 * `SEMANTICA_POR_DEFECTO`, que no son de marca justamente porque «bien» y «cuidado» no son
 * decisiones de marca. Un tema los toca cuando los suyos conviven mejor con su paleta.
 */
export const SEMANTIC_ROLES = ['error', 'exito', 'advertencia'] as const;
export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

/** Un color de origen valido: hexadecimal de seis digitos. Es lo que el derivador sabe leer. */
export function sourceColorIs(valor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valor.trim());
}
