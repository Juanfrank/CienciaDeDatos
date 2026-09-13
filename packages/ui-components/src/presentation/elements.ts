import type { Alignment, TextColor, TextStyle } from './contract';

/** Elementos: los objetos que NO se enlazan a un origen de datos. */

/* ── Cuadro de texto ───────────────────────────────────────────────────────────────────────── */

/** Texto con formato, escrito a mano. */
export interface TextParagraph {
  content: string;
  style?: TextStyle;
  /** Nivel de encabezado. Sin el, es un parrafo corriente. */
  nivel?: 1 | 2 | 3;
  /** Vineta: convierte el parrafo en punto de una lista. */
  vineta?: boolean;
}

export interface TextBoxSettings {
  parrafos: TextParagraph[];
}

export const DEFAULT_BOX_TEXT: TextBoxSettings = {
  parrafos: [{ content: 'Escriba aqui.' }],
};

/* ── Titulo de seccion ─────────────────────────────────────────────────────────────────────── */

/** Donde estan las lineas de un titulo de seccion. */
export const LINE_POSITIONS = ['ninguna', 'izquierda', 'derecha', 'ambos', 'arriba', 'abajo'] as const;
export type LinePosition = (typeof LINE_POSITIONS)[number];

export const LINE_STYLES = ['solida', 'discontinua', 'punteada'] as const;
export type LineStyle = (typeof LINE_STYLES)[number];

export interface LineSettings {
  style?: LineStyle;
  /** Grosor en pixeles. Acotado: una linea de 20 px deja de ser una linea. */
  thickness?: number;
  color?: TextColor;
}

export interface SectionTitleSettings {
  content: string;
  /** Donde va el texto cuando las lineas no lo encierran. */
  textPosition?: Alignment;
  line?: LinePosition;
  estiloDeLinea?: LineSettings;
}

export const DEFAULT_TITLE_SECTION: SectionTitleSettings = {
  content: 'Seccion',
  textPosition: 'izquierda',
  line: 'derecha',
  estiloDeLinea: { style: 'solida', thickness: 1, color: 'atenuado' },
};

/* ── Linea divisoria ───────────────────────────────────────────────────────────────────────── */

export const ORIENTACIONES = ['horizontal', 'vertical'] as const;
export type Orientation = (typeof ORIENTACIONES)[number];

/** Una linea, sola. */
export interface DividerLineSettings extends LineSettings {
  orientation?: Orientation;
}

export const DEFAULT_LINE_DIVIDER: DividerLineSettings = {
  orientation: 'horizontal',
  style: 'solida',
  thickness: 1,
  color: 'atenuado',
};

/* ── Formas ────────────────────────────────────────────────────────────────────────────────── */

export const SHAPES = ['rectangulo', 'cuadrado', 'triangulo', 'circulo', 'rombo', 'flecha'] as const;
export type Shape = (typeof SHAPES)[number];

/** Una forma basica. */
export interface ShapeSettings {
  forma: Shape;
  relleno?: TextColor;
  stroke?: TextColor;
  strokeThickness?: number;
  /** 0 a 100. Deja ver lo que hay debajo cuando la forma se usa como resaltado de fondo. */
  opacidad?: number;
  /** Radio de las esquinas, en pixeles. Solo para las formas que tienen esquinas. */
  radio?: number;
  /** Texto opcional dentro de la forma. */
  content?: string;
  estiloDeTexto?: TextStyle;
}

export const DEFAULT_SHAPE: ShapeSettings = {
  forma: 'rectangulo',
  relleno: 'primario',
  opacidad: 12,
  radio: 8,
};

/* ── Conexiones ────────────────────────────────────────────────────────────────────────────── */

export const ENDS = ['ninguno', 'flecha', 'punto'] as const;
export type End = (typeof ENDS)[number];

export const TRAZADOS = ['recto', 'angulo', 'curva'] as const;
export type Dash = (typeof TRAZADOS)[number];

/** Un conector de diagrama entre dos objetos del modulo. */
export interface ConnectionSettings {
  /** `id` del `GridItem` de origen. */
  desde?: string;
  /** `id` del `GridItem` de destino. */
  hasta?: string;
  dash?: Dash;
  initialEnd?: End;
  extremoFinal?: End;
  estiloDeLinea?: LineSettings;
  /** Rotulo sobre el conector. */
  content?: string;
}

export const DEFAULT_CONNECTION: ConnectionSettings = {
  dash: 'angulo',
  extremoFinal: 'flecha',
  estiloDeLinea: { style: 'solida', thickness: 2, color: 'primario' },
};

/* ── El sobre comun ────────────────────────────────────────────────────────────────────────── */

/** La configuracion de un elemento, sea cual sea. */
export interface ElementSettings {
  textBox?: TextBoxSettings;
  sectionTitle?: SectionTitleSettings;
  lineDivider?: DividerLineSettings;
  forma?: ShapeSettings;
  conexion?: ConnectionSettings;
}

/** Los objectId de los elementos, en el mismo sitio que su configuracion. */
export const ELEMENTS = [
  'cuadro-de-texto',
  'titulo-de-seccion',
  'linea-divisoria',
  'forma',
  'conexion',
] as const;
export type ElementId = (typeof ELEMENTS)[number];

export const isElement = (objectId: string): objectId is ElementId =>
  (ELEMENTS as readonly string[]).includes(objectId);

/** Los elementos que se dibujan SIN tarjeta. */
export const WITHOUT_CARD: readonly string[] = [
  'linea-divisoria',
  'conexion',
  'titulo-de-seccion',
  'forma',
];

/** Grosor util de una linea, acotado. Mas de esto deja de leerse como linea. */
export const grosorValido = (thickness: number | undefined): number =>
  Math.min(8, Math.max(1, Math.round(thickness ?? 1)));

/** El trazo CSS de un estilo de linea. */
export const lineStroke = (style: LineStyle | undefined): string =>
  style === 'discontinua' ? 'dashed' : style === 'punteada' ? 'dotted' : 'solid';
