import { hexFromArgb } from '@material/material-color-utilities';
import {
  type MaterialScheme,
  type ColorMode,
  type RoleTones,
  type ThemeSource,
  schemeFor,
  palettesFor,
} from './material3';

/** El resto del sistema de Material Design 3: tipografia, forma, elevacion y capas de estado. */

/** Escala tipografica de MD3: cinco familias de rol, tres tamanos cada una. */
export interface TypographicStyle {
  size: string;
  lineHeight: string;
  weight: number;
  tracking: string;
}

export type TypographicRole =
  | 'display-large' | 'display-medium' | 'display-small'
  | 'headline-large' | 'headline-medium' | 'headline-small'
  | 'title-large' | 'title-medium' | 'title-small'
  | 'body-large' | 'body-medium' | 'body-small'
  | 'label-large' | 'label-medium' | 'label-small';

export const TYPOGRAPHY: Record<TypographicRole, TypographicStyle> = {
  'display-large': { size: '3.5625rem', lineHeight: '4rem', weight: 400, tracking: '-0.015625rem' },
  'display-medium': { size: '2.8125rem', lineHeight: '3.25rem', weight: 400, tracking: '0' },
  'display-small': { size: '2.25rem', lineHeight: '2.75rem', weight: 400, tracking: '0' },

  'headline-large': { size: '2rem', lineHeight: '2.5rem', weight: 400, tracking: '0' },
  'headline-medium': { size: '1.75rem', lineHeight: '2.25rem', weight: 400, tracking: '0' },
  'headline-small': { size: '1.5rem', lineHeight: '2rem', weight: 400, tracking: '0' },

  'title-large': { size: '1.375rem', lineHeight: '1.75rem', weight: 400, tracking: '0' },
  'title-medium': { size: '1rem', lineHeight: '1.5rem', weight: 500, tracking: '0.009375rem' },
  'title-small': { size: '0.875rem', lineHeight: '1.25rem', weight: 500, tracking: '0.00625rem' },

  'body-large': { size: '1rem', lineHeight: '1.5rem', weight: 400, tracking: '0.03125rem' },
  'body-medium': { size: '0.875rem', lineHeight: '1.25rem', weight: 400, tracking: '0.015625rem' },
  'body-small': { size: '0.75rem', lineHeight: '1rem', weight: 400, tracking: '0.025rem' },

  'label-large': { size: '0.875rem', lineHeight: '1.25rem', weight: 500, tracking: '0.00625rem' },
  'label-medium': { size: '0.75rem', lineHeight: '1rem', weight: 500, tracking: '0.03125rem' },
  'label-small': { size: '0.6875rem', lineHeight: '1rem', weight: 500, tracking: '0.03125rem' },
};

/**
 * La escala de la linea grafica: tamanos exactos, y el peso donde Material pone el tamano.
 *
 * Dos diferencias de fondo con la de Material, y las dos son deliberadas.
 *
 * La primera es que es MAS PEQUENA y mas cerrada: de 10,5 px a 36 px, contra los 11 px a 57 px de
 * Material. Es la escala de un tablero, donde la pantalla la ocupan los datos y el texto esta para
 * rotularlos; la de Material es la de una aplicacion donde el texto ES el contenido.
 *
 * La segunda es que jerarquiza con el PESO. Material sube de tamano y deja casi todo en 400; aqui
 * los titulos van en 700 y 800 y los tamanos se mueven poco, que es lo que permite meter cuatro
 * niveles de titulo en una tarjeta sin que el mayor parezca un cartel.
 */
const ESCALA_COMPACTA: Record<TypographicRole, TypographicStyle> = {
  'display-large': { size: '2.25rem', lineHeight: '2.5rem', weight: 800, tracking: '-0.03125rem' },
  'display-medium': { size: '1.875rem', lineHeight: '2.25rem', weight: 800, tracking: '-0.015625rem' },
  'display-small': { size: '1.625rem', lineHeight: '2rem', weight: 800, tracking: '-0.0125rem' },

  'headline-large': { size: '1.375rem', lineHeight: '1.75rem', weight: 700, tracking: '0' },
  'headline-medium': { size: '1.1875rem', lineHeight: '1.625rem', weight: 700, tracking: '0' },
  'headline-small': { size: '1rem', lineHeight: '1.5rem', weight: 700, tracking: '0' },

  'title-large': { size: '0.9375rem', lineHeight: '1.375rem', weight: 700, tracking: '0' },
  'title-medium': { size: '0.875rem', lineHeight: '1.25rem', weight: 600, tracking: '0' },
  'title-small': { size: '0.84375rem', lineHeight: '1.25rem', weight: 600, tracking: '0' },

  'body-large': { size: '0.90625rem', lineHeight: '1.5rem', weight: 400, tracking: '0' },
  'body-medium': { size: '0.84375rem', lineHeight: '1.375rem', weight: 400, tracking: '0' },
  'body-small': { size: '0.78125rem', lineHeight: '1.125rem', weight: 400, tracking: '0' },

  'label-large': { size: '0.78125rem', lineHeight: '1.125rem', weight: 600, tracking: '0' },
  'label-medium': { size: '0.6875rem', lineHeight: '1rem', weight: 600, tracking: '0.00625rem' },
  // El rotulo de una insignia va en versalitas apretadas: sin algo de interletraje se emborrona.
  'label-small': { size: '0.65625rem', lineHeight: '0.875rem', weight: 700, tracking: '0.025rem' },
};

/**
 * Las escalas tipograficas que un tema puede elegir. Conjunto CERRADO, por lo mismo que las letras.
 *
 * Una escala son quince roles con cuatro valores cada uno: sesenta numeros que tienen que guardar
 * proporcion entre si. Dejar escribir uno suelto desde una pantalla no da flexibilidad, da una
 * escala rota —un `body-large` mas pequeno que su `body-medium`— y no hay forma de comprobarlo
 * sin volver a escribir aqui la relacion que se acaba de abrir.
 */
export const TYPE_SCALES = { material: TYPOGRAPHY, compacta: ESCALA_COMPACTA } as const;
export type TypeScaleId = keyof typeof TYPE_SCALES;

export const TYPE_SCALE_NAMES: Record<TypeScaleId, string> = {
  material: 'Material (institucional)',
  compacta: 'Compacta, jerarquia por peso',
};

/** Escala de forma. `full` es una pastilla; el valor grande deja que el borde lo resuelva. */
export const SHAPE = {
  none: '0',
  'extra-small': '4px',
  small: '8px',
  medium: '12px',
  large: '16px',
  'extra-large': '28px',
  full: '9999px',
} as const;

/** Los siete nombres de radio, con el valor que les de cada escala. */
export type ShapeScale = Record<keyof typeof SHAPE, string>;

/**
 * Tres radios y nada mas: 8 px, 12 px y la pastilla.
 *
 * Los siete escalones de Material reparten el redondeo por tamano de componente, y eso solo se
 * nota cuando una pantalla tiene componentes de muchos tamanos. Un tablero es una rejilla de
 * tarjetas del mismo orden de tamano: con siete radios, dos tarjetas contiguas se redondean
 * distinto sin que nadie lo haya decidido, y es de las cosas que se ven sin poder senalarse.
 *
 * Los nombres SIGUEN siendo los siete de Material —lo que cambia es que varios valen lo mismo—
 * porque son los que las hojas de estilo ya nombran. Un tema no puede obligar a reescribir el CSS
 * de la aplicacion: si pudiera, no seria un tema.
 *
 * Los usan los DOS temas de fabrica. Que la escala de Material siga existiendo no es inercia: es
 * el valor de quien no dice nada, y borrarla haria que un tema sin `cornerRadius` se pintara con
 * una decision de marca que nunca tomo.
 */
const TRES_RADIOS: ShapeScale = {
  none: '0',
  'extra-small': '8px',
  small: '8px',
  medium: '12px',
  large: '12px',
  'extra-large': '12px',
  full: '999px',
};

export const SHAPE_SCALES = { material: SHAPE, 'tres-radios': TRES_RADIOS } as const;
export type ShapeScaleId = keyof typeof SHAPE_SCALES;

export const SHAPE_SCALE_NAMES: Record<ShapeScaleId, string> = {
  material: 'Material: siete radios por tamano',
  'tres-radios': 'Tres radios: 8, 12 y pastilla',
};

/**
 * Cuanto pesa el borde que separa una tarjeta de su fondo.
 *
 * Solo mueve `outlineVariant`, que es el borde DECORATIVO: el que dibuja el contorno de una
 * tarjeta, la divisoria de una tabla y el separador de una seccion. `outline` —el de los campos,
 * los selects y los botones— no se toca, porque ahi el borde no adorna, dice donde se puede
 * escribir; aclararlo seria quitarle el contorno a un control, que es lo que 1.4.11 no permite.
 *
 * `tenue` lo sube al tono 92 en claro. No es un numero elegido a ojo: da 1,23 de contraste sobre
 * la superficie blanca, que es exactamente el que tiene el `--line` de la linea grafica sobre su
 * propia superficie. En oscuro BAJA al 20 en vez de subir, porque ahi el borde se separa del
 * fondo por ser mas claro, y «tenue» quiere decir menos separado, no mas claro.
 */
export const OUTLINE_SCALES = {
  material: {},
  tenue: { outlineVariant: { light: 92, dark: 20 } },
} as const satisfies Record<string, RoleTones>;

export type OutlineScaleId = keyof typeof OUTLINE_SCALES;

export const OUTLINE_SCALE_NAMES: Record<OutlineScaleId, string> = {
  material: 'Material: borde marcado',
  tenue: 'Tenue: apenas separa la tarjeta del fondo',
};

/**
 * Elevacion: seis niveles, cada uno con su sombra.
 *
 * Una sombra son DOS decisiones independientes, y por eso se eligen por separado.
 *
 * La primera es su FORMA: cuantas capas, con que desenfoque y con que opacidad. Es lo que hace
 * que una tarjeta parezca apoyada en el papel o flotando muy por encima, y no tiene nada que ver
 * con la marca.
 *
 * La segunda es su TINTE. Una sombra negra sobre superficies que tiran a azul se ve gris sucia, y
 * es lo que hace que una pantalla «no termine de verse limpia» sin que se pueda senalar que
 * falla. Tenida con el color del propio tema, la sombra se integra con el fondo en vez de
 * ensuciarlo.
 *
 * Atarlas —«la sombra de marca es ademas la difusa»— daria menos codigo y un tema que no puede
 * tener la sombra de Material en su propio azul, que es una combinacion perfectamente razonable.
 */
export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type Elevation = Record<ElevationLevel, string>;

/** La rampa de la especificacion: dos capas cortas, opacidad alta, poco desenfoque. */
const RAMPA_MATERIAL = (t: string): Elevation => ({
  0: 'none',
  1: `0 1px 2px 0 rgba(${t},.30), 0 1px 3px 1px rgba(${t},.15)`,
  2: `0 1px 2px 0 rgba(${t},.30), 0 2px 6px 2px rgba(${t},.15)`,
  3: `0 4px 8px 3px rgba(${t},.15), 0 1px 3px 0 rgba(${t},.30)`,
  4: `0 6px 10px 4px rgba(${t},.15), 0 2px 3px 0 rgba(${t},.30)`,
  5: `0 8px 12px 6px rgba(${t},.15), 0 4px 4px 0 rgba(${t},.30)`,
});

/**
 * La rampa de la linea grafica: un contacto fino y un halo ancho, los dos casi transparentes.
 *
 * Los niveles 1 y 2 son literalmente las dos sombras que aquella guia documenta —la ligera de las
 * tarjetas de indicador y la de tarjeta—; 3, 4 y 5 continuan la misma progresion, porque una
 * rampa a la que le faltan escalones obliga a que un dialogo y una tarjeta se dibujen iguales.
 *
 * La diferencia con Material esta en el reparto: donde aquella pone .30 de opacidad a 1 px, esta
 * pone .05 a 12 px de desenfoque. La sombra deja de verse como un borde gris y pasa a verse como
 * luz, que es lo que separa una tarjeta del papel sin dibujarle un contorno.
 */
const RAMPA_DIFUSA = (t: string): Elevation => ({
  0: 'none',
  1: `0 1px 3px rgba(${t},.06)`,
  2: `0 1px 2px rgba(${t},.05), 0 12px 32px rgba(${t},.08)`,
  3: `0 2px 4px rgba(${t},.06), 0 18px 44px rgba(${t},.10)`,
  4: `0 3px 6px rgba(${t},.07), 0 24px 56px rgba(${t},.12)`,
  5: `0 4px 8px rgba(${t},.08), 0 32px 72px rgba(${t},.14)`,
});

export const SHADOW_SHAPES = { material: RAMPA_MATERIAL, difusa: RAMPA_DIFUSA } as const;
export type ShadowShapeId = keyof typeof SHADOW_SHAPES;

export const SHADOW_SHAPE_NAMES: Record<ShadowShapeId, string> = {
  material: 'Material: contacto corto y marcado',
  difusa: 'Difusa: contacto fino y halo ancho',
};

/** La rampa de siempre, sobre el tinte que se le pase. */
export const elevationFor = (tinte: string, forma: ShadowShapeId = 'material'): Elevation =>
  SHADOW_SHAPES[forma](tinte);

/** El tinte neutro: negro, que es lo que dice la especificacion y lo que habia. */
export const TINTE_NEUTRO = '0,0,0';

/** Elevacion con la forma y el tinte de siempre. */
export const ELEVATION = elevationFor(TINTE_NEUTRO);

/** Opacidad de las capas de estado. */
export const STATUS = { hover: 0.08, focus: 0.1, pressed: 0.1, dragged: 0.16, disabled: 0.38 } as const;

/** Duraciones y curvas de movimiento. */
export const MOVIMIENTO = {
  'duration-short': '150ms',
  'duration-medium': '250ms',
  'duration-long': '400ms',
  'easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'easing-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
  'easing-decelerate': 'cubic-bezier(0, 0, 0, 1)',
} as const;

/** Paleta categorica para series de datos, derivada de las paletas tonales. */
/** Tonos de la paleta categorica, por modo. */
const TONOS_CATEGORICOS: Record<ColorMode, [keyof ReturnType<typeof palettesFor>, number][]> = {
  light: [
    ['primary', 40], ['tertiary', 40], ['secondary', 40],
    ['primary', 25], ['tertiary', 25], ['secondary', 25],
    ['primary', 55], ['tertiary', 55],
  ],
  dark: [
    ['primary', 80], ['tertiary', 80], ['secondary', 80],
    ['primary', 65], ['tertiary', 65], ['secondary', 65],
    ['primary', 90], ['tertiary', 90],
  ],
};

/** Paleta categorica para series de datos, derivada de las paletas tonales. */
export function categoricalFor(source: ThemeSource, mode: ColorMode): string[] {
  const p = palettesFor(source);
  return TONOS_CATEGORICOS[mode].map(([family, tono]) => hexFromArgb(p[family].tone(tono)));
}

export interface MaterialTheme {
  mode: ColorMode;
  color: MaterialScheme;
  categorical: string[];
  typography: Record<TypographicRole, TypographicStyle>;
  shape: ShapeScale;
  elevation: Elevation;
  state: typeof STATUS;
  motion: typeof MOVIMIENTO;
  font: { sans: string; mono: string; serif: string };
}

/**
 * Todo lo que un tema decide aparte del color: la letra, sus tamanos, los radios y la sombra.
 *
 * Va junto y no como cuatro parametros sueltos porque es UNA decision —«asi se ve este tema»— y
 * porque cuatro argumentos opcionales del mismo tipo en fila son cuatro oportunidades de pasarlos
 * cambiados sin que el compilador diga nada.
 */
export interface ThemeStyle {
  fonts: { sans: string; mono: string; serif: string };
  typography: Record<TypographicRole, TypographicStyle>;
  shape: ShapeScale;
  shadowShape: ShadowShapeId;
  /** Componentes `r,g,b` del color de la sombra. */
  shadowTint: string;
  /** Tonos que este tema mueve respecto de la especificacion. Ver `OUTLINE_SCALES`. */
  tones: RoleTones;
}

export function materialTheme(
  source: ThemeSource,
  mode: ColorMode,
  estilo: ThemeStyle,
): MaterialTheme {
  return {
    mode,
    color: schemeFor(source, mode, estilo.tones),
    categorical: categoricalFor(source, mode),
    typography: estilo.typography,
    shape: estilo.shape,
    elevation: elevationFor(estilo.shadowTint, estilo.shadowShape),
    state: STATUS,
    motion: MOVIMIENTO,
    font: estilo.fonts,
  };
}

/**
 * El tinte de sombra de un tema, sacado de su PROPIO primario.
 *
 * Tono 30 y no el primario tal cual: un azul de accion a plena luz usado como sombra sale azul
 * electrico y parece un resplandor, no una sombra. El tono 30 es el mismo color en su version
 * profunda, que es lo que la luz deja debajo de una tarjeta.
 *
 * Se deriva y no se guarda: un tema no tiene que contestar de que color es su sombra, y si lo
 * contestara podria contestar algo que no tiene nada que ver con su marca.
 *
 * En OSCURO devuelve el neutro, y no es una excepcion perezosa. Un tinte de marca funciona porque
 * la sombra compite con un fondo claro al que se parece; sobre una superficie casi negra no hay
 * nada que integrar —lo unico que puede hacer la luz ahi es faltar—, y un azul profundo sobre
 * negro no se lee como sombra sino como un halo de color alrededor de la tarjeta.
 */
export function tintOf(source: ThemeSource, mode: ColorMode = 'light'): string {
  if (mode === 'dark') return TINTE_NEUTRO;
  const argb = palettesFor(source).primary.tone(30);
  return [(argb >> 16) & 255, (argb >> 8) & 255, argb & 255].join(',');
}

/** Variables CSS con los nombres de MD3 (`--md-sys-*`). */
export function materialVariables(theme: MaterialTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  const guion = (role: string) => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

  for (const [role, valor] of Object.entries(theme.color)) {
    vars[`--md-sys-color-${guion(role)}`] = valor;
  }
  theme.categorical.forEach((color, i) => {
    vars[`--md-sys-color-categorical-${i}`] = color;
  });

  for (const [role, style] of Object.entries(theme.typography)) {
    vars[`--md-sys-typescale-${role}-size`] = style.size;
    vars[`--md-sys-typescale-${role}-line-height`] = style.lineHeight;
    vars[`--md-sys-typescale-${role}-weight`] = String(style.weight);
    vars[`--md-sys-typescale-${role}-tracking`] = style.tracking;
    /*
     * Y el rol COMPLETO, valido como abreviatura `font:`.
     */
    vars[`--md-sys-typescale-${role}`] =
      `${style.weight} ${style.size}/${style.lineHeight} ${theme.font.sans}`;
  }

  for (const [nombre, valor] of Object.entries(theme.shape)) {
    vars[`--md-sys-shape-corner-${nombre}`] = valor;
  }
  for (const [nivel, sombra] of Object.entries(theme.elevation)) {
    vars[`--md-sys-elevation-${nivel}`] = sombra;
  }
  for (const [nombre, valor] of Object.entries(theme.state)) {
    vars[`--md-sys-state-${nombre}-opacity`] = String(valor);
  }
  for (const [nombre, valor] of Object.entries(theme.motion)) {
    vars[`--md-sys-motion-${nombre}`] = valor;
  }

  vars['--md-ref-typeface-plain'] = theme.font.sans;
  vars['--md-ref-typeface-mono'] = theme.font.mono;
  // `brand` es el nombre que le da Material a la tipografia de display frente a la de lectura.
  vars['--md-ref-typeface-brand'] = theme.font.serif;

  return vars;
}
