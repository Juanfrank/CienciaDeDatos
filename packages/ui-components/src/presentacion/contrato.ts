import { COMPARADORES, MAX_REGLAS, type FormatoCondicional } from './condicional';
import { esNombreDeIcono, type NombreDeIcono } from './iconos';
import {
  TIPOS_DE_FORMATO,
  type FormatoDeNumero,
  type FormatosDelObjeto,
  formatoDeMedida,
  formateadorDeNumero,
  problemaDelPatron,
} from './numero';

/** El minimo de personalizacion que TODO objeto visual admite — seccion 4.2 y 4.3. */

/** El acento es un ROL, no un color. */
export const ACENTOS = ['primario', 'secundario', 'terciario', 'neutro'] as const;
export type AcentoDeObjeto = (typeof ACENTOS)[number];

/** Donde va la leyenda, no solo si esta. */
export const MODOS_DE_LEYENDA = ['auto', 'oculta', 'arriba', 'abajo', 'izquierda', 'derecha'] as const;
export type ModoDeLeyenda = (typeof MODOS_DE_LEYENDA)[number];

/** Los ejes, como en cualquier herramienta de informes. */
export interface ConfiguracionDeEjes {
  mostrarX?: boolean;
  mostrarY?: boolean;
  tituloX?: string;
  tituloY?: string;
  /** El titulo del eje de la derecha, cuando hay dos. */
  tituloY2?: string;
  /** Las lineas horizontales de fondo. Con pocas barras estorban mas que ayudan. */
  cuadricula?: boolean;
  /** Empezar el eje de valores en cero. */
  desdeCero?: boolean;
  /** Los limites del eje de valores, a mano. */
  minimoY?: number;
  maximoY?: number;
  /** Cuanto se giran los rotulos del eje de categorias. */
  rotarX?: number;
}

/** ---- Lineas de referencia ---- */
export const ESTILOS_DE_REFERENCIA = ['solida', 'discontinua', 'punteada'] as const;
export type EstiloDeReferencia = (typeof ESTILOS_DE_REFERENCIA)[number];

export interface LineaDeReferencia {
  valor: number;
  etiqueta?: string;
  color?: ColorDeTexto;
  estilo?: EstiloDeReferencia;
}

/** Mas de tres rayas sobre un grafico dejan de ser referencias y pasan a ser una rejilla. */
export const MAX_REFERENCIAS = 3;

/** Como se apilan las series. */
export const MODOS_DE_APILADO = ['ninguno', 'apilado', 'porcentaje'] as const;
export type ModoDeApilado = (typeof MODOS_DE_APILADO)[number];

/** ---- Circular: pastel y dona ---- */
export const ETIQUETAS_CIRCULARES = [
  'ninguna',
  'categoria',
  'valor',
  'porcentaje',
  'categoria-porcentaje',
] as const;
export type EtiquetaCircular = (typeof ETIQUETAS_CIRCULARES)[number];

export interface ConfiguracionCircular {
  /** El hueco del centro, en porcentaje del radio. 0 es un pastel; 55 es una dona. */
  radioInterior?: number;
  labels?: EtiquetaCircular;
  /** Ordenar las porciones de mayor a menor. Encendido por defecto: es como se compara un area. */
  ordenar?: boolean;
  /** El total en el centro de la dona. Solo se dibuja si hay hueco donde ponerlo. */
  totalEnElCentro?: boolean;
}

/** ---- Medidor (tacometro) ---- */
/** ---- Combinado de columnas y lineas ---- */
export interface ConfiguracionDeCombinado {
  ejeSecundario?: boolean;
}

/** ---- Embudo ---- */
export const COMPARACIONES_DE_EMBUDO = ['primero', 'anterior', 'ninguna'] as const;
export type ComparacionDeEmbudo = (typeof COMPARACIONES_DE_EMBUDO)[number];

export interface ConfiguracionDeEmbudo {
  comparar?: ComparacionDeEmbudo;
}

/** ---- Cascada ---- */
export interface ConfiguracionDeCascada {
  /** Una ultima barra, desde cero, con la suma. Encendida por defecto: es a donde lleva todo. */
  mostrarTotal?: boolean;
}

export interface ConfiguracionDeMedidor {
  minimo?: number;
  maximo?: number;
  /** El objetivo, cuando es un numero fijo y no una medida del dataset. */
  objetivo?: number;
  /** Mostrar la cifra bajo la aguja. Encendida por defecto: un angulo no es un numero. */
  mostrarValor?: boolean;
}

/** Por que se ordenan las categorias del eje. Power BI lo llama «ordenar eje». */
export const CRITERIOS_DE_ORDEN = ['categoria', 'valor'] as const;
export type CriterioDeOrden = (typeof CRITERIOS_DE_ORDEN)[number];

export interface OrdenDeCategorias {
  por?: CriterioDeOrden;
  direccion?: 'asc' | 'desc';
}

/** Compatibilidad: la forma anterior del formato, que era del OBJETO y no de la medida. */
export interface FormatoNumerico {
  /** 0 a 4. Mas alla, la cifra deja de leerse y empieza a ser ruido de precision. */
  decimales?: number;
  /** Sufijo corto: «casos», «%», «dias». Ocho caracteres es una unidad; mas es una frase. */
  unidad?: string;
  /** 12.500 pasa a «12,5 mil». Util en una tarjeta, molesto en una tabla. */
  compacto?: boolean;
}

/** ---- Texto: peso, estilo, alineacion y color ---- */
export const COLORES_DE_TEXTO = [
  'predeterminado',
  'primario',
  'secundario',
  'terciario',
  'error',
  'atenuado',
] as const;
export type ColorDeTexto = (typeof COLORES_DE_TEXTO)[number];

export const ALINEACIONES = ['izquierda', 'centro', 'derecha'] as const;
export type Alineacion = (typeof ALINEACIONES)[number];

/** Solo donde hay alto que repartir: una celda de tabla o el cuerpo de una tarjeta. */
export const ALINEACIONES_VERTICALES = ['arriba', 'medio', 'abajo'] as const;
export type AlineacionVertical = (typeof ALINEACIONES_VERTICALES)[number];

export interface EstiloDeTexto {
  negrita?: boolean;
  cursiva?: boolean;
  subrayado?: boolean;
  alineacion?: Alineacion;
  alineacionVertical?: AlineacionVertical;
  color?: ColorDeTexto;
}

/** A QUE textos se les puede poner estilo. Conjunto cerrado, como todo lo demas. */
export const DESTINOS_DE_TEXTO = ['titulo', 'subtitulo', 'valor', 'etiqueta'] as const;
export type DestinoDeTexto = (typeof DESTINOS_DE_TEXTO)[number];

export type TextosDeObjeto = Partial<Record<DestinoDeTexto, EstiloDeTexto>>;

/** Variable CSS del rol, o nada para el color que ya tuviera el texto. */
const VARIABLE_DE_COLOR: Record<ColorDeTexto, string | null> = {
  predeterminado: null,
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-on-surface-variant)',
};

const ALINEACION_CSS: Record<Alineacion, string> = {
  izquierda: 'left',
  centro: 'center',
  derecha: 'right',
};

const VERTICAL_CSS: Record<AlineacionVertical, string> = {
  arriba: 'flex-start',
  medio: 'center',
  abajo: 'flex-end',
};

/** El METODO COMUN: un estilo de texto a propiedades CSS. */
export function estiloDeTexto(estilo: EstiloDeTexto | undefined): Record<string, string> {
  if (!estilo) return {};
  const css: Record<string, string> = {};
  if (estilo.negrita) css['fontWeight'] = '700';
  if (estilo.cursiva) css['fontStyle'] = 'italic';
  if (estilo.subrayado) css['textDecoration'] = 'underline';
  if (estilo.alineacion) css['textAlign'] = ALINEACION_CSS[estilo.alineacion];
  if (estilo.alineacionVertical) css['justifyContent'] = VERTICAL_CSS[estilo.alineacionVertical];
  const color = estilo.color ? VARIABLE_DE_COLOR[estilo.color] : null;
  if (color) css['color'] = color;
  return css;
}

/** ---- Etiquetas de dato ---- */
export const POSICIONES_DE_DATO = ['auto', 'encima', 'debajo', 'dentro'] as const;
export type PosicionDeDato = (typeof POSICIONES_DE_DATO)[number];

export interface ConfiguracionDeEtiquetas {
  mostrar?: boolean;
  posicion?: PosicionDeDato;
  /** Solo el maximo y el minimo de cada serie. Con muchas categorias es la unica opcion legible. */
  soloExtremos?: boolean;
}

/** La forma anterior era un `boolean`, y lo sigue siendo para lo ya guardado. */
export type EtiquetasDeDato = boolean | ConfiguracionDeEtiquetas;

export function etiquetasNormalizadas(valor: EtiquetasDeDato | undefined): ConfiguracionDeEtiquetas {
  if (valor === undefined) return { mostrar: false };
  if (typeof valor === 'boolean') return { mostrar: valor };
  return { mostrar: true, ...valor };
}

/** ---- Tooltip ---- */
/** ---- Pequenos multiplos ---- */
export interface ConfiguracionDeMultiplos {
  columnas?: number;
  mismaEscala?: boolean;
}

export interface ConfiguracionDeTooltip {
  /** Una ultima fila con la suma de las series de esa categoria. */
  total?: boolean;
  /** Ordenar las filas de mayor a menor en vez de por el orden de las series. */
  ordenarPorValor?: boolean;
}

/** Donde va la etiqueta respecto del valor en una tarjeta. */
export const POSICIONES_DE_ETIQUETA = ['encima', 'debajo'] as const;
export type PosicionDeEtiqueta = (typeof POSICIONES_DE_ETIQUETA)[number];

/** La etiqueta que acompana al valor en una tarjeta. */
export interface EtiquetaDeValor {
  texto?: string;
  posicion?: PosicionDeEtiqueta;
}

export interface PresentacionDeObjeto {
  /** Icono del catalogo, en la cabecera. Sin el, el objeto usa el de su tipo. */
  icono?: NombreDeIcono;
  /** Rol del tema que tine el icono y la linea de resaltado. */
  acento?: AcentoDeObjeto;
  /** Linea de color en el borde superior de la tarjeta. */
  resaltado?: boolean;
  /** Color de la linea de resaltado, si debe ser otro que el acento. */
  colorDeResaltado?: ColorDeTexto;
  /** Mostrar la cabecera con el titulo. Por defecto si. */
  mostrarTitulo?: boolean;
  /** Mostrar el icono junto al titulo. Por defecto si. */
  mostrarIcono?: boolean;
  /** El rotulo que acompana a la cifra en una tarjeta. */
  etiqueta?: EtiquetaDeValor;
  /** Una linea bajo el titulo. Para la unidad, el periodo o la salvedad. */
  subtitulo?: string;
  formato?: FormatoNumerico;
  /** Formato de numero POR MEDIDA, con un renglon general de respaldo. */
  formatos?: FormatosDelObjeto;
  leyenda?: ModoDeLeyenda;
  /** La cifra encima de cada barra o punto, con el formato de SU medida. */
  etiquetasDeDato?: EtiquetasDeDato;
  tooltip?: ConfiguracionDeTooltip;
  multiplos?: ConfiguracionDeMultiplos;
  /** Que el color dependa del dato: reglas evaluadas en orden, gana la primera que casa. */
  condicional?: FormatoCondicional;
  ejes?: ConfiguracionDeEjes;
  orden?: OrdenDeCategorias;
  apilado?: ModoDeApilado;
  circular?: ConfiguracionCircular;
  combinado?: ConfiguracionDeCombinado;
  /** La meta, el promedio, el umbral: hasta tres rayas sobre el area de dibujo. */
  referencias?: LineaDeReferencia[];
  /** Que color de la paleta usa cada serie, por indice. */
  coloresDeSerie?: number[];
  embudo?: ConfiguracionDeEmbudo;
  cascada?: ConfiguracionDeCascada;
  medidor?: ConfiguracionDeMedidor;
  /** Peso, estilo, alineacion y color de los textos del objeto. */
  textos?: TextosDeObjeto;
}

/** TODAS las claves de presentacion, como dato. */
export const CLAVES_DE_PRESENTACION = [
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
] as const satisfies readonly (keyof PresentacionDeObjeto)[];

export type ClaveDePresentacion = keyof PresentacionDeObjeto;

/** Las cinco que no son negociables. */
export const PRESENTACION_MINIMA: ClaveDePresentacion[] = [
  'icono',
  'acento',
  'resaltado',
  'colorDeResaltado',
  'mostrarTitulo',
  'mostrarIcono',
  'subtitulo',
  'textos',
];

export interface ProblemaDePresentacion {
  clave: string;
  problema: string;
}

export const MAX_SUBTITULO = 80;
export const MAX_UNIDAD = 8;
export const MAX_DECIMALES = 4;
/** El hueco maximo de una dona. Por encima queda un hilo, no un anillo que se pueda comparar. */
export const MAX_RADIO_INTERIOR = 80;

/** Valida una presentacion contra lo que el objeto declara admitir. */
export function validarPresentacion(
  presentacion: PresentacionDeObjeto | undefined,
  admitidas: ClaveDePresentacion[],
): ProblemaDePresentacion[] {
  if (!presentacion) return [];
  const problems: ProblemaDePresentacion[] = [];
  const admite = new Set<string>(admitidas);

  for (const clave of Object.keys(presentacion)) {
    if (!admite.has(clave)) {
      problems.push({
        clave,
        problema: `Este objeto no admite '${clave}'. Admite: ${admitidas.join(', ')}.`,
      });
    }
  }

  if (presentacion.icono !== undefined && !esNombreDeIcono(presentacion.icono)) {
    problems.push({
      clave: 'icono',
      problema: `'${String(presentacion.icono)}' no es un icono del catalogo.`,
    });
  }

  if (
    presentacion.acento !== undefined &&
    !(ACENTOS as readonly string[]).includes(presentacion.acento)
  ) {
    problems.push({
      clave: 'acento',
      problema: `'${String(presentacion.acento)}' no es un acento. Use: ${ACENTOS.join(', ')}.`,
    });
  }

  /*
   * Los estilos de texto, destino a destino.
   */
  for (const [destino, estilo] of Object.entries(presentacion.textos ?? {})) {
    if (!(DESTINOS_DE_TEXTO as readonly string[]).includes(destino)) {
      problems.push({
        clave: `textos.${destino}`,
        problema: `'${destino}' no es un texto configurable. Use: ${DESTINOS_DE_TEXTO.join(', ')}.`,
      });
      continue;
    }
    if (estilo.color !== undefined && !(COLORES_DE_TEXTO as readonly string[]).includes(estilo.color)) {
      problems.push({
        clave: `textos.${destino}.color`,
        problema:
          `'${String(estilo.color)}' no es un color del tema. Use: ${COLORES_DE_TEXTO.join(', ')}. ` +
          `Un color suelto no tiene par de contraste comprobado y no sigue al tema dark (4.3).`,
      });
    }
    if (estilo.alineacion !== undefined && !(ALINEACIONES as readonly string[]).includes(estilo.alineacion)) {
      problems.push({
        clave: `textos.${destino}.alineacion`,
        problema: `'${String(estilo.alineacion)}' no es una alineacion. Use: ${ALINEACIONES.join(', ')}.`,
      });
    }
    if (
      estilo.alineacionVertical !== undefined &&
      !(ALINEACIONES_VERTICALES as readonly string[]).includes(estilo.alineacionVertical)
    ) {
      problems.push({
        clave: `textos.${destino}.alineacionVertical`,
        problema:
          `'${String(estilo.alineacionVertical)}' no es una alineacion vertical. ` +
          `Use: ${ALINEACIONES_VERTICALES.join(', ')}.`,
      });
    }
  }

  /*
   * El formato de numero, renglon a renglon.
   */
  const renglones: [string, FormatoDeNumero | undefined][] = [
    ['general', presentacion.formatos?.general],
    ...Object.entries(presentacion.formatos?.porMedida ?? {}),
  ];
  for (const [nombre, formato] of renglones) {
    if (!formato) continue;
    if (formato.tipo !== undefined && !(TIPOS_DE_FORMATO as readonly string[]).includes(formato.tipo)) {
      problems.push({
        clave: `formatos.${nombre}.tipo`,
        problema: `'${String(formato.tipo)}' no es un tipo de formato. Use: ${TIPOS_DE_FORMATO.join(', ')}.`,
      });
    }
    if (formato.tipo === 'personalizado') {
      const problema = formato.patron === undefined ? 'falta la cadena.' : problemaDelPatron(formato.patron);
      if (problema) {
        problems.push({
          clave: `formatos.${nombre}.patron`,
          problema: `El formato personalizado de '${nombre}' ${problema}`,
        });
      }
    }
    if (formato.decimales !== undefined && (formato.decimales < 0 || formato.decimales > 6)) {
      problems.push({
        clave: `formatos.${nombre}.decimales`,
        problema:
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
        problema:
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
      problema: `El giro va de -90 a 90 grados, y ${ejes.rotarX} no esta en ese rango.`,
    });
  }
  if (ejes?.minimoY !== undefined && ejes.maximoY !== undefined && ejes.minimoY >= ejes.maximoY) {
    problems.push({
      clave: 'ejes.maximoY',
      problema: `El maximo del eje (${ejes.maximoY}) tiene que ser mayor que el minimo (${ejes.minimoY}).`,
    });
  }

  if (presentacion.referencias !== undefined) {
    if (presentacion.referencias.length > MAX_REFERENCIAS) {
      problems.push({
        clave: 'referencias',
        problema:
          `${presentacion.referencias.length} lineas de referencia. El maximo es ` +
          `${MAX_REFERENCIAS}: mas rayas sobre un grafico dejan de ser referencias y pasan a ser ` +
          `una rejilla.`,
      });
    }
    presentacion.referencias.forEach((linea, i) => {
      if (!Number.isFinite(linea.valor)) {
        problems.push({
          clave: `referencias.${i}.valor`,
          problema: 'Una linea de referencia necesita un valor numerico: es donde se dibuja.',
        });
      }
      if (linea.color !== undefined && !(COLORES_DE_TEXTO as readonly string[]).includes(linea.color)) {
        problems.push({
          clave: `referencias.${i}.color`,
          problema: `'${String(linea.color)}' no es un color del tema. Use: ${COLORES_DE_TEXTO.join(', ')}.`,
        });
      }
      if (
        linea.estilo !== undefined &&
        !(ESTILOS_DE_REFERENCIA as readonly string[]).includes(linea.estilo)
      ) {
        problems.push({
          clave: `referencias.${i}.estilo`,
          problema: `'${String(linea.estilo)}' no es un estilo. Use: ${ESTILOS_DE_REFERENCIA.join(', ')}.`,
        });
      }
    });
  }

  const reglas = presentacion.condicional?.reglas;
  if (reglas !== undefined) {
    if (reglas.length > MAX_REGLAS) {
      problems.push({
        clave: 'condicional',
        problema:
          `${reglas.length} reglas de color. El maximo es ${MAX_REGLAS}: mas dejan de ser ` +
          `excepciones y pasan a ser una escala, que es otra herramienta.`,
      });
    }
    reglas.forEach((regla, i) => {
      if (!(COMPARADORES as readonly string[]).includes(regla.comparador)) {
        problems.push({
          clave: `condicional.${i}.comparador`,
          problema: `'${String(regla.comparador)}' no es una comparacion. Use: ${COMPARADORES.join(', ')}.`,
        });
      }
      if (!Number.isFinite(regla.valor)) {
        problems.push({
          clave: `condicional.${i}.valor`,
          problema: 'Una regla necesita un numero con el que comparar.',
        });
      }
      /*
       * `entre` sin el otro extremo no es un rango incompleto: es una regla que NUNCA casa.
       * Guardarla dejaria un color en el panel que no se aplica nunca y nadie sabria por que.
       */
      if (regla.comparador === 'entre' && regla.hasta === undefined) {
        problems.push({
          clave: `condicional.${i}.hasta`,
          problema: 'La comparacion «entre» necesita los dos extremos; con uno solo no casa nunca.',
        });
      }
      if (!(COLORES_DE_TEXTO as readonly string[]).includes(regla.color)) {
        problems.push({
          clave: `condicional.${i}.color`,
          problema: `'${String(regla.color)}' no es un color del tema. Use: ${COLORES_DE_TEXTO.join(', ')}.`,
        });
      }
    });
  }

  for (const [i, indice] of (presentacion.coloresDeSerie ?? []).entries()) {
    if (!Number.isInteger(indice) || indice < 0 || indice > 7) {
      problems.push({
        clave: `coloresDeSerie.${i}`,
        problema: `'${String(indice)}' no es un color de la paleta. La paleta del tema tiene ocho, de 0 a 7.`,
      });
    }
  }

  if (
    presentacion.embudo?.comparar !== undefined &&
    !(COMPARACIONES_DE_EMBUDO as readonly string[]).includes(presentacion.embudo.comparar)
  ) {
    problems.push({
      clave: 'embudo.comparar',
      problema:
        `'${String(presentacion.embudo.comparar)}' no es una comparacion. ` +
        `Use: ${COMPARACIONES_DE_EMBUDO.join(', ')}.`,
    });
  }

  if (
    circular?.labels !== undefined &&
    !(ETIQUETAS_CIRCULARES as readonly string[]).includes(circular.labels)
  ) {
    problems.push({
      clave: 'circular.etiquetas',
      problema: `'${String(circular.labels)}' no es un modo. Use: ${ETIQUETAS_CIRCULARES.join(', ')}.`,
    });
  }

  /*
   * Un minimo por encima del maximo no es un rango: es una escala del reves.
   */
  const medidor = presentacion.medidor;
  if (medidor?.minimo !== undefined && medidor.maximo !== undefined && medidor.minimo >= medidor.maximo) {
    problems.push({
      clave: 'medidor.maximo',
      problema: `El maximo (${medidor.maximo}) tiene que ser mayor que el minimo (${medidor.minimo}).`,
    });
  }

  if (presentacion.subtitulo !== undefined && presentacion.subtitulo.length > MAX_SUBTITULO) {
    problems.push({
      clave: 'subtitulo',
      problema: `El subtitulo pasa de ${MAX_SUBTITULO} caracteres. Es una linea, no un parrafo.`,
    });
  }

  if (
    presentacion.leyenda !== undefined &&
    !(MODOS_DE_LEYENDA as readonly string[]).includes(presentacion.leyenda)
  ) {
    problems.push({
      clave: 'leyenda',
      problema: `'${String(presentacion.leyenda)}' no es un modo. Use: ${MODOS_DE_LEYENDA.join(', ')}.`,
    });
  }

  const { decimales, unidad } = presentacion.formato ?? {};
  if (decimales !== undefined && (!Number.isInteger(decimales) || decimales < 0 || decimales > MAX_DECIMALES)) {
    problems.push({
      clave: 'formato.decimales',
      problema: `Los decimales van de 0 a ${MAX_DECIMALES}.`,
    });
  }
  if (unidad !== undefined && unidad.length > MAX_UNIDAD) {
    problems.push({
      clave: 'formato.unidad',
      problema: `La unidad pasa de ${MAX_UNIDAD} caracteres. Es un sufijo, no una explicacion.`,
    });
  }

  return problems;
}

/** El formateador que sale de una presentacion. */
/** @returns un formateador que acepta `null` y lo dibuja como raya. */
/** Traduce la forma ANTERIOR del formato a la nueva. */
export const comoFormatoDeNumero = (formato: FormatoNumerico | undefined): FormatoDeNumero =>
  formato
    ? {
        tipo: formato.decimales === undefined ? 'general' : 'decimal',
        ...(formato.decimales === undefined ? {} : { decimales: formato.decimales }),
        ...(formato.unidad === undefined ? {} : { unidad: formato.unidad }),
        ...(formato.compacto === undefined ? {} : { compacto: formato.compacto }),
      }
    : {};

/** El formateador de UNA medida del objeto. */
export function formateadorDeMedida(
  presentacion: PresentacionDeObjeto | undefined,
  medida?: string,
): (n: number | null) => string {
  const porMedida = presentacion?.formatos
    ? formatoDeMedida(presentacion.formatos, medida)
    : undefined;
  // `formatos` manda sobre `formato` por ser lo mas especifico; `formato` es la forma anterior y
  // se interpreta como el renglon general, que es justo lo que era.
  return formateadorDeNumero(porMedida ?? comoFormatoDeNumero(presentacion?.formato));
}

/** Compatibilidad: el formateador de la forma anterior, del objeto entero. */
export function formateadorDe(formato: FormatoNumerico | undefined): (n: number | null) => string {
  return formateadorDeNumero(comoFormatoDeNumero(formato));
}
