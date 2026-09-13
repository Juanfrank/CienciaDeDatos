import { COMPARATORS, MAX_RULES, type ConditionalFormat } from './conditional';
import { iconNameIs, type IconName } from './icons';
import {
  FORMAT_KINDS,
  type NumberFormat,
  type ObjectFormats,
  measureFormat,
  numberFormatter,
  problemaDelPatron,
} from './number';

/** El minimo de personalizacion que TODO objeto visual admite — seccion 4.2 y 4.3. */

/** El acento es un ROL, no un color. */
export const ACCENTS = ['primario', 'secundario', 'terciario', 'neutro'] as const;
export type ObjectAccent = (typeof ACCENTS)[number];

/** Donde va la leyenda, no solo si esta. */
export const LEGEND_MODES = ['auto', 'oculta', 'arriba', 'abajo', 'izquierda', 'derecha'] as const;
export type LegendMode = (typeof LEGEND_MODES)[number];

/** Los ejes, como en cualquier herramienta de informes. */
export interface AxisSettings {
  mostrarX?: boolean;
  mostrarY?: boolean;
  tituloX?: string;
  tituloY?: string;
  /** El titulo del eje de la derecha, cuando hay dos. */
  tituloY2?: string;
  /** Las lineas horizontales de fondo. Con pocas barras estorban mas que ayudan. */
  gridlines?: boolean;
  /** Empezar el eje de valores en cero. */
  desdeCero?: boolean;
  /** Los limites del eje de valores, a mano. */
  minimoY?: number;
  maximoY?: number;
  /** Cuanto se giran los rotulos del eje de categorias. */
  rotarX?: number;
}

/** ---- Lineas de referencia ---- */
export const REFERENCE_STYLES = ['solida', 'discontinua', 'punteada'] as const;
export type ReferenceStyle = (typeof REFERENCE_STYLES)[number];

export interface ReferenceLine {
  valor: number;
  etiqueta?: string;
  color?: TextColor;
  style?: ReferenceStyle;
}

/** Mas de tres rayas sobre un grafico dejan de ser referencias y pasan a ser una rejilla. */
export const MAX_REFERENCES = 3;

/** Como se apilan las series. */
export const STACKING_MODES = ['ninguno', 'apilado', 'porcentaje'] as const;
export type StackingMode = (typeof STACKING_MODES)[number];

/** ---- Circular: pastel y dona ---- */
export const ETIQUETAS_CIRCULARES = [
  'ninguna',
  'categoria',
  'valor',
  'porcentaje',
  'categoria-porcentaje',
] as const;
export type PieLabel = (typeof ETIQUETAS_CIRCULARES)[number];

export interface PieSettings {
  /** El hueco del centro, en porcentaje del radio. 0 es un pastel; 55 es una dona. */
  radioInterior?: number;
  labels?: PieLabel;
  /** Ordenar las porciones de mayor a menor. Encendido por defecto: es como se compara un area. */
  ordenar?: boolean;
  /** El total en el centro de la dona. Solo se dibuja si hay hueco donde ponerlo. */
  totalEnElCentro?: boolean;
}

/** ---- Medidor (tacometro) ---- */
/** ---- Combinado de columnas y lineas ---- */
export interface ComboSettings {
  axisSecondary?: boolean;
}

/** ---- Embudo ---- */
export const FUNNEL_COMPARISONS = ['primero', 'anterior', 'ninguna'] as const;
export type FunnelComparison = (typeof FUNNEL_COMPARISONS)[number];

export interface FunnelSettings {
  compare?: FunnelComparison;
}

/** ---- Cascada ---- */
export interface WaterfallSettings {
  /** Una ultima barra, desde cero, con la suma. Encendida por defecto: es a donde lleva todo. */
  showTotal?: boolean;
}

export interface GaugeSettings {
  minimo?: number;
  maximo?: number;
  /** El objetivo, cuando es un numero fijo y no una medida del dataset. */
  objetivo?: number;
  /** Mostrar la cifra bajo la aguja. Encendida por defecto: un angulo no es un numero. */
  showValue?: boolean;
}

/** Por que se ordenan las categorias del eje. Power BI lo llama «ordenar eje». */
export const SORT_CRITERIA = ['categoria', 'valor'] as const;
export type SortCriterion = (typeof SORT_CRITERIA)[number];

export interface CategorySort {
  por?: SortCriterion;
  direction?: 'asc' | 'desc';
}

/** Compatibilidad: la forma anterior del formato, que era del OBJETO y no de la medida. */
export interface FormatoNumerico {
  /** 0 a 4. Mas alla, la cifra deja de leerse y empieza a ser ruido de precision. */
  decimales?: number;
  /** Sufijo corto: «casos», «%», «dias». Ocho caracteres es una unidad; mas es una frase. */
  unit?: string;
  /** 12.500 pasa a «12,5 mil». Util en una tarjeta, molesto en una tabla. */
  compacto?: boolean;
}

/** ---- Texto: peso, estilo, alineacion y color ---- */
export const TEXT_COLORS = [
  'predeterminado',
  'primario',
  'secundario',
  'terciario',
  'error',
  'atenuado',
] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

export const ALIGNMENTS = ['izquierda', 'centro', 'derecha'] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

/** Solo donde hay alto que repartir: una celda de tabla o el cuerpo de una tarjeta. */
export const VERTICAL_ALIGNMENTS = ['arriba', 'medio', 'abajo'] as const;
export type VerticalAlignment = (typeof VERTICAL_ALIGNMENTS)[number];

export interface TextStyle {
  negrita?: boolean;
  cursiva?: boolean;
  subrayado?: boolean;
  alignment?: Alignment;
  verticalAlignment?: VerticalAlignment;
  color?: TextColor;
}

/** A QUE textos se les puede poner estilo. Conjunto cerrado, como todo lo demas. */
export const DESTINOS_DE_TEXTO = ['titulo', 'subtitulo', 'valor', 'etiqueta'] as const;
export type DestinoDeTexto = (typeof DESTINOS_DE_TEXTO)[number];

export type ObjectTexts = Partial<Record<DestinoDeTexto, TextStyle>>;

/** Variable CSS del rol, o nada para el color que ya tuviera el texto. */
const VARIABLE_DE_COLOR: Record<TextColor, string | null> = {
  predeterminado: null,
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-on-surface-variant)',
};

const ALIGNMENT_CSS: Record<Alignment, string> = {
  izquierda: 'left',
  centro: 'center',
  derecha: 'right',
};

const VERTICAL_CSS: Record<VerticalAlignment, string> = {
  arriba: 'flex-start',
  medio: 'center',
  abajo: 'flex-end',
};

/** El METODO COMUN: un estilo de texto a propiedades CSS. */
export function estiloDeTexto(style: TextStyle | undefined): Record<string, string> {
  if (!style) return {};
  const css: Record<string, string> = {};
  if (style.negrita) css['fontWeight'] = '700';
  if (style.cursiva) css['fontStyle'] = 'italic';
  if (style.subrayado) css['textDecoration'] = 'underline';
  if (style.alignment) css['textAlign'] = ALIGNMENT_CSS[style.alignment];
  if (style.verticalAlignment) css['justifyContent'] = VERTICAL_CSS[style.verticalAlignment];
  const color = style.color ? VARIABLE_DE_COLOR[style.color] : null;
  if (color) css['color'] = color;
  return css;
}

/** ---- Etiquetas de dato ---- */
export const DATUM_POSITIONS = ['auto', 'encima', 'debajo', 'dentro'] as const;
export type DatumPosition = (typeof DATUM_POSITIONS)[number];

export interface LabelSettings {
  mostrar?: boolean;
  cellPosition?: DatumPosition;
  /** Solo el maximo y el minimo de cada serie. Con muchas categorias es la unica opcion legible. */
  onlyEnds?: boolean;
}

/** La forma anterior era un `boolean`, y lo sigue siendo para lo ya guardado. */
export type DatumLabels = boolean | LabelSettings;

export function etiquetasNormalizadas(valor: DatumLabels | undefined): LabelSettings {
  if (valor === undefined) return { mostrar: false };
  if (typeof valor === 'boolean') return { mostrar: valor };
  return { mostrar: true, ...valor };
}

/** ---- Tooltip ---- */
/** ---- Pequenos multiplos ---- */
export interface MultipleSettings {
  gridColumns?: number;
  sameScale?: boolean;
}

export interface TooltipSettings {
  /** Una ultima fila con la suma de las series de esa categoria. */
  total?: boolean;
  /** Ordenar las filas de mayor a menor en vez de por el orden de las series. */
  sortValue?: boolean;
}

/** Donde va la etiqueta respecto del valor en una tarjeta. */
export const LABEL_POSITIONS = ['encima', 'debajo'] as const;
export type LabelPosition = (typeof LABEL_POSITIONS)[number];

/** La etiqueta que acompana al valor en una tarjeta. */
export interface ValueLabel {
  content?: string;
  cellPosition?: LabelPosition;
}

export interface ObjectPresentation {
  /** Icono del catalogo, en la cabecera. Sin el, el objeto usa el de su tipo. */
  icono?: IconName;
  /** Rol del tema que tine el icono y la linea de resaltado. */
  acento?: ObjectAccent;
  /** Linea de color en el borde superior de la tarjeta. */
  resaltado?: boolean;
  /** Color de la linea de resaltado, si debe ser otro que el acento. */
  colorDeResaltado?: TextColor;
  /** Mostrar la cabecera con el titulo. Por defecto si. */
  mostrarTitulo?: boolean;
  /** Mostrar el icono junto al titulo. Por defecto si. */
  mostrarIcono?: boolean;
  /** El rotulo que acompana a la cifra en una tarjeta. */
  etiqueta?: ValueLabel;
  /** Una linea bajo el titulo. Para la unidad, el periodo o la salvedad. */
  subtitulo?: string;
  formato?: FormatoNumerico;
  /** Formato de numero POR MEDIDA, con un renglon general de respaldo. */
  formatos?: ObjectFormats;
  leyenda?: LegendMode;
  /** La cifra encima de cada barra o punto, con el formato de SU medida. */
  etiquetasDeDato?: DatumLabels;
  tooltip?: TooltipSettings;
  multiplos?: MultipleSettings;
  /** Que el color dependa del dato: reglas evaluadas en orden, gana la primera que casa. */
  condicional?: ConditionalFormat;
  ejes?: AxisSettings;
  orden?: CategorySort;
  apilado?: StackingMode;
  circular?: PieSettings;
  combinado?: ComboSettings;
  /** La meta, el promedio, el umbral: hasta tres rayas sobre el area de dibujo. */
  referencias?: ReferenceLine[];
  /** Que color de la paleta usa cada serie, por indice. */
  coloresDeSerie?: number[];
  embudo?: FunnelSettings;
  cascada?: WaterfallSettings;
  medidor?: GaugeSettings;
  /** Peso, estilo, alineacion y color de los textos del objeto. */
  textos?: ObjectTexts;
}

/** TODAS las claves de presentacion, como dato. */
export const PRESENTATION_KEYS = [
  'icono',
  'acento',
  'resaltado',
  'colorDeResaltado',
  'mostrarTitulo',
  'mostrarIcono',
  'subtitulo',
  'etiqueta',
  'textos',
  'formato',
  'formatos',
  'leyenda',
  'etiquetasDeDato',
  'ejes',
  'orden',
  'apilado',
  'circular',
  'combinado',
  'referencias',
  'coloresDeSerie',
  'tooltip',
  'multiplos',
  'condicional',
  'embudo',
  'cascada',
  'medidor',
] as const satisfies readonly (keyof ObjectPresentation)[];

export type PresentationKey = keyof ObjectPresentation;

/** Las cinco que no son negociables. */
export const PRESENTACION_MINIMA: PresentationKey[] = [
  'icono',
  'acento',
  'resaltado',
  'colorDeResaltado',
  'mostrarTitulo',
  'mostrarIcono',
  'subtitulo',
  'textos',
];

export interface PresentationProblem {
  clave: string;
  issue: string;
}

export const MAX_SUBTITLE = 80;
export const MAX_UNIT = 8;
export const MAX_DECIMALS = 4;
/** El hueco maximo de una dona. Por encima queda un hilo, no un anillo que se pueda comparar. */
export const MAX_RADIO_INTERIOR = 80;

/** Valida una presentacion contra lo que el objeto declara admitir. */
export function validatePresentation(
  presentacion: ObjectPresentation | undefined,
  admitidas: PresentationKey[],
): PresentationProblem[] {
  if (!presentacion) return [];
  const problems: PresentationProblem[] = [];
  const admite = new Set<string>(admitidas);

  for (const clave of Object.keys(presentacion)) {
    if (!admite.has(clave)) {
      problems.push({
        clave,
        issue: `Este objeto no admite '${clave}'. Admite: ${admitidas.join(', ')}.`,
      });
    }
  }

  if (presentacion.icono !== undefined && !iconNameIs(presentacion.icono)) {
    problems.push({
      clave: 'icono',
      issue: `'${String(presentacion.icono)}' no es un icono del catalogo.`,
    });
  }

  if (
    presentacion.acento !== undefined &&
    !(ACCENTS as readonly string[]).includes(presentacion.acento)
  ) {
    problems.push({
      clave: 'acento',
      issue: `'${String(presentacion.acento)}' no es un acento. Use: ${ACCENTS.join(', ')}.`,
    });
  }

  /*
   * Los estilos de texto, destino a destino.
   */
  for (const [destino, style] of Object.entries(presentacion.textos ?? {})) {
    if (!(DESTINOS_DE_TEXTO as readonly string[]).includes(destino)) {
      problems.push({
        clave: `textos.${destino}`,
        issue: `'${destino}' no es un texto configurable. Use: ${DESTINOS_DE_TEXTO.join(', ')}.`,
      });
      continue;
    }
    if (style.color !== undefined && !(TEXT_COLORS as readonly string[]).includes(style.color)) {
      problems.push({
        clave: `textos.${destino}.color`,
        issue:
          `'${String(style.color)}' no es un color del tema. Use: ${TEXT_COLORS.join(', ')}. ` +
          `Un color suelto no tiene par de contraste comprobado y no sigue al tema dark (4.3).`,
      });
    }
    if (style.alignment !== undefined && !(ALIGNMENTS as readonly string[]).includes(style.alignment)) {
      problems.push({
        clave: `textos.${destino}.alineacion`,
        issue: `'${String(style.alignment)}' no es una alineacion. Use: ${ALIGNMENTS.join(', ')}.`,
      });
    }
    if (
      style.verticalAlignment !== undefined &&
      !(VERTICAL_ALIGNMENTS as readonly string[]).includes(style.verticalAlignment)
    ) {
      problems.push({
        clave: `textos.${destino}.verticalAlignment`,
        issue:
          `'${String(style.verticalAlignment)}' no es una alineacion vertical. ` +
          `Use: ${VERTICAL_ALIGNMENTS.join(', ')}.`,
      });
    }
  }

  /*
   * El formato de numero, renglon a renglon.
   */
  const renglones: [string, NumberFormat | undefined][] = [
    ['general', presentacion.formatos?.general],
    ...Object.entries(presentacion.formatos?.porMedida ?? {}),
  ];
  for (const [nombre, formato] of renglones) {
    if (!formato) continue;
    if (formato.tipo !== undefined && !(FORMAT_KINDS as readonly string[]).includes(formato.tipo)) {
      problems.push({
        clave: `formatos.${nombre}.tipo`,
        issue: `'${String(formato.tipo)}' no es un tipo de formato. Use: ${FORMAT_KINDS.join(', ')}.`,
      });
    }
    if (formato.tipo === 'personalizado') {
      const issue = formato.patron === undefined ? 'falta la cadena.' : problemaDelPatron(formato.patron);
      if (issue) {
        problems.push({
          clave: `formatos.${nombre}.patron`,
          issue: `El formato personalizado de '${nombre}' ${issue}`,
        });
      }
    }
    if (formato.decimales !== undefined && (formato.decimales < 0 || formato.decimales > 6)) {
      problems.push({
        clave: `formatos.${nombre}.decimales`,
        issue:
          `${formato.decimales} decimales no se pueden mostrar. Entre 0 y 6: mas alla, la cifra ` +
          `deja de leerse y empieza a ser ruido de precision.`,
      });
    }
  }

  const circular = presentacion.circular;
  if (circular?.radioInterior !== undefined) {
    if (circular.radioInterior < 0 || circular.radioInterior > MAX_RADIO_INTERIOR) {
      problems.push({
        clave: 'circular.radioInterior',
        issue:
          `El hueco va de 0 a ${MAX_RADIO_INTERIOR} % del radio. Por encima no queda anillo que ` +
          `comparar: el grafico dejaria de decir nada sobre las proporciones.`,
      });
    }
  }
  /*
   * Un maximo por debajo del minimo no es un rango: es una escala del reves.
   */
  const ejes = presentacion.ejes;
  if (ejes?.rotarX !== undefined && (ejes.rotarX < -90 || ejes.rotarX > 90)) {
    problems.push({
      clave: 'ejes.rotarX',
      issue: `El giro va de -90 a 90 grados, y ${ejes.rotarX} no esta en ese rango.`,
    });
  }
  if (ejes?.minimoY !== undefined && ejes.maximoY !== undefined && ejes.minimoY >= ejes.maximoY) {
    problems.push({
      clave: 'ejes.maximoY',
      issue: `El maximo del eje (${ejes.maximoY}) tiene que ser mayor que el minimo (${ejes.minimoY}).`,
    });
  }

  if (presentacion.referencias !== undefined) {
    if (presentacion.referencias.length > MAX_REFERENCES) {
      problems.push({
        clave: 'referencias',
        issue:
          `${presentacion.referencias.length} lineas de referencia. El maximo es ` +
          `${MAX_REFERENCES}: mas rayas sobre un grafico dejan de ser referencias y pasan a ser ` +
          `una rejilla.`,
      });
    }
    presentacion.referencias.forEach((line, i) => {
      if (!Number.isFinite(line.valor)) {
        problems.push({
          clave: `referencias.${i}.valor`,
          issue: 'Una linea de referencia necesita un valor numerico: es donde se dibuja.',
        });
      }
      if (line.color !== undefined && !(TEXT_COLORS as readonly string[]).includes(line.color)) {
        problems.push({
          clave: `referencias.${i}.color`,
          issue: `'${String(line.color)}' no es un color del tema. Use: ${TEXT_COLORS.join(', ')}.`,
        });
      }
      if (
        line.style !== undefined &&
        !(REFERENCE_STYLES as readonly string[]).includes(line.style)
      ) {
        problems.push({
          clave: `referencias.${i}.estilo`,
          issue: `'${String(line.style)}' no es un estilo. Use: ${REFERENCE_STYLES.join(', ')}.`,
        });
      }
    });
  }

  const rules = presentacion.condicional?.rules;
  if (rules !== undefined) {
    if (rules.length > MAX_RULES) {
      problems.push({
        clave: 'condicional',
        issue:
          `${rules.length} reglas de color. El maximo es ${MAX_RULES}: mas dejan de ser ` +
          `excepciones y pasan a ser una escala, que es otra herramienta.`,
      });
    }
    rules.forEach((colorRule, i) => {
      if (!(COMPARATORS as readonly string[]).includes(colorRule.comparator)) {
        problems.push({
          clave: `condicional.${i}.comparador`,
          issue: `'${String(colorRule.comparator)}' no es una comparacion. Use: ${COMPARATORS.join(', ')}.`,
        });
      }
      if (!Number.isFinite(colorRule.valor)) {
        problems.push({
          clave: `condicional.${i}.valor`,
          issue: 'Una regla necesita un numero con el que comparar.',
        });
      }
      /*
       * `entre` sin el otro extremo no es un rango incompleto: es una regla que NUNCA casa.
       * Guardarla dejaria un color en el panel que no se aplica nunca y nadie sabria por que.
       */
      if (colorRule.comparator === 'entre' && colorRule.hasta === undefined) {
        problems.push({
          clave: `condicional.${i}.hasta`,
          issue: 'La comparacion «entre» necesita los dos extremos; con uno solo no casa nunca.',
        });
      }
      if (!(TEXT_COLORS as readonly string[]).includes(colorRule.color)) {
        problems.push({
          clave: `condicional.${i}.color`,
          issue: `'${String(colorRule.color)}' no es un color del tema. Use: ${TEXT_COLORS.join(', ')}.`,
        });
      }
    });
  }

  for (const [i, indice] of (presentacion.coloresDeSerie ?? []).entries()) {
    if (!Number.isInteger(indice) || indice < 0 || indice > 7) {
      problems.push({
        clave: `coloresDeSerie.${i}`,
        issue: `'${String(indice)}' no es un color de la paleta. La paleta del tema tiene ocho, de 0 a 7.`,
      });
    }
  }

  if (
    presentacion.embudo?.compare !== undefined &&
    !(FUNNEL_COMPARISONS as readonly string[]).includes(presentacion.embudo.compare)
  ) {
    problems.push({
      clave: 'embudo.comparar',
      issue:
        `'${String(presentacion.embudo.compare)}' no es una comparacion. ` +
        `Use: ${FUNNEL_COMPARISONS.join(', ')}.`,
    });
  }

  if (
    circular?.labels !== undefined &&
    !(ETIQUETAS_CIRCULARES as readonly string[]).includes(circular.labels)
  ) {
    problems.push({
      clave: 'circular.etiquetas',
      issue: `'${String(circular.labels)}' no es un modo. Use: ${ETIQUETAS_CIRCULARES.join(', ')}.`,
    });
  }

  /*
   * Un minimo por encima del maximo no es un rango: es una escala del reves.
   */
  const medidor = presentacion.medidor;
  if (medidor?.minimo !== undefined && medidor.maximo !== undefined && medidor.minimo >= medidor.maximo) {
    problems.push({
      clave: 'medidor.maximo',
      issue: `El maximo (${medidor.maximo}) tiene que ser mayor que el minimo (${medidor.minimo}).`,
    });
  }

  if (presentacion.subtitulo !== undefined && presentacion.subtitulo.length > MAX_SUBTITLE) {
    problems.push({
      clave: 'subtitulo',
      issue: `El subtitulo pasa de ${MAX_SUBTITLE} caracteres. Es una linea, no un parrafo.`,
    });
  }

  if (
    presentacion.leyenda !== undefined &&
    !(LEGEND_MODES as readonly string[]).includes(presentacion.leyenda)
  ) {
    problems.push({
      clave: 'leyenda',
      issue: `'${String(presentacion.leyenda)}' no es un modo. Use: ${LEGEND_MODES.join(', ')}.`,
    });
  }

  const { decimales, unit } = presentacion.formato ?? {};
  if (decimales !== undefined && (!Number.isInteger(decimales) || decimales < 0 || decimales > MAX_DECIMALS)) {
    problems.push({
      clave: 'formato.decimales',
      issue: `Los decimales van de 0 a ${MAX_DECIMALS}.`,
    });
  }
  if (unit !== undefined && unit.length > MAX_UNIT) {
    problems.push({
      clave: 'formato.unidad',
      issue: `La unidad pasa de ${MAX_UNIT} caracteres. Es un sufijo, no una explicacion.`,
    });
  }

  return problems;
}

/** El formateador que sale de una presentacion. */
/** @returns un formateador que acepta `null` y lo dibuja como raya. */
/** Traduce la forma ANTERIOR del formato a la nueva. */
export const numberFormatAs = (formato: FormatoNumerico | undefined): NumberFormat =>
  formato
    ? {
        tipo: formato.decimales === undefined ? 'general' : 'decimal',
        ...(formato.decimales === undefined ? {} : { decimales: formato.decimales }),
        ...(formato.unit === undefined ? {} : { unit: formato.unit }),
        ...(formato.compacto === undefined ? {} : { compacto: formato.compacto }),
      }
    : {};

/** El formateador de UNA medida del objeto. */
export function measureFormatter(
  presentacion: ObjectPresentation | undefined,
  medida?: string,
): (n: number | null) => string {
  const porMedida = presentacion?.formatos
    ? measureFormat(presentacion.formatos, medida)
    : undefined;
  // `formatos` manda sobre `formato` por ser lo mas especifico; `formato` es la forma anterior y
  // se interpreta como el renglon general, que es justo lo que era.
  return numberFormatter(porMedida ?? numberFormatAs(presentacion?.formato));
}

/** Compatibilidad: el formateador de la forma anterior, del objeto entero. */
export function formatterOf(formato: FormatoNumerico | undefined): (n: number | null) => string {
  return numberFormatter(numberFormatAs(formato));
}
