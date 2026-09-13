import type { Alineacion, ColorDeTexto, EstiloDeTexto } from './contrato';

/** Elementos: los objetos que NO se enlazan a un origen de datos. */

/* ── Cuadro de texto ───────────────────────────────────────────────────────────────────────── */

/** Texto con formato, escrito a mano. */
export interface ParrafoDeTexto {
  texto: string;
  estilo?: EstiloDeTexto;
  /** Nivel de encabezado. Sin el, es un parrafo corriente. */
  nivel?: 1 | 2 | 3;
  /** Vineta: convierte el parrafo en punto de una lista. */
  vineta?: boolean;
}

export interface ConfiguracionDeCuadroDeTexto {
  parrafos: ParrafoDeTexto[];
}

export const CUADRO_DE_TEXTO_POR_DEFECTO: ConfiguracionDeCuadroDeTexto = {
  parrafos: [{ texto: 'Escriba aqui.' }],
};

/* ── Titulo de seccion ─────────────────────────────────────────────────────────────────────── */

/** Donde estan las lineas de un titulo de seccion. */
export const POSICIONES_DE_LINEA = ['ninguna', 'izquierda', 'derecha', 'ambos', 'arriba', 'abajo'] as const;
export type PosicionDeLinea = (typeof POSICIONES_DE_LINEA)[number];

export const ESTILOS_DE_LINEA = ['solida', 'discontinua', 'punteada'] as const;
export type EstiloDeLinea = (typeof ESTILOS_DE_LINEA)[number];

export interface ConfiguracionDeLinea {
  estilo?: EstiloDeLinea;
  /** Grosor en pixeles. Acotado: una linea de 20 px deja de ser una linea. */
  grosor?: number;
  color?: ColorDeTexto;
}

export interface ConfiguracionDeTituloDeSeccion {
  texto: string;
  /** Donde va el texto cuando las lineas no lo encierran. */
  posicionDelTexto?: Alineacion;
  linea?: PosicionDeLinea;
  estiloDeLinea?: ConfiguracionDeLinea;
}

export const TITULO_DE_SECCION_POR_DEFECTO: ConfiguracionDeTituloDeSeccion = {
  texto: 'Seccion',
  posicionDelTexto: 'izquierda',
  linea: 'derecha',
  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'atenuado' },
};

/* ── Linea divisoria ───────────────────────────────────────────────────────────────────────── */

export const ORIENTACIONES = ['horizontal', 'vertical'] as const;
export type Orientacion = (typeof ORIENTACIONES)[number];

/** Una linea, sola. */
export interface ConfiguracionDeLineaDivisoria extends ConfiguracionDeLinea {
  orientacion?: Orientacion;
}

export const LINEA_DIVISORIA_POR_DEFECTO: ConfiguracionDeLineaDivisoria = {
  orientacion: 'horizontal',
  estilo: 'solida',
  grosor: 1,
  color: 'atenuado',
};

/* ── Formas ────────────────────────────────────────────────────────────────────────────────── */

export const FORMAS = ['rectangulo', 'cuadrado', 'triangulo', 'circulo', 'rombo', 'flecha'] as const;
export type Forma = (typeof FORMAS)[number];

/** Una forma basica. */
export interface ConfiguracionDeForma {
  forma: Forma;
  relleno?: ColorDeTexto;
  trazo?: ColorDeTexto;
  grosorDeTrazo?: number;
  /** 0 a 100. Deja ver lo que hay debajo cuando la forma se usa como resaltado de fondo. */
  opacidad?: number;
  /** Radio de las esquinas, en pixeles. Solo para las formas que tienen esquinas. */
  radio?: number;
  /** Texto opcional dentro de la forma. */
  texto?: string;
  estiloDeTexto?: EstiloDeTexto;
}

export const FORMA_POR_DEFECTO: ConfiguracionDeForma = {
  forma: 'rectangulo',
  relleno: 'primario',
  opacidad: 12,
  radio: 8,
};

/* ── Conexiones ────────────────────────────────────────────────────────────────────────────── */

export const EXTREMOS = ['ninguno', 'flecha', 'punto'] as const;
export type Extremo = (typeof EXTREMOS)[number];

export const TRAZADOS = ['recto', 'angulo', 'curva'] as const;
export type Trazado = (typeof TRAZADOS)[number];

/** Un conector de diagrama entre dos objetos del modulo. */
export interface ConfiguracionDeConexion {
  /** `id` del `GridItem` de origen. */
  desde?: string;
  /** `id` del `GridItem` de destino. */
  hasta?: string;
  trazado?: Trazado;
  extremoInicial?: Extremo;
  extremoFinal?: Extremo;
  estiloDeLinea?: ConfiguracionDeLinea;
  /** Rotulo sobre el conector. */
  texto?: string;
}

export const CONEXION_POR_DEFECTO: ConfiguracionDeConexion = {
  trazado: 'angulo',
  extremoFinal: 'flecha',
  estiloDeLinea: { estilo: 'solida', grosor: 2, color: 'primario' },
};

/* ── El sobre comun ────────────────────────────────────────────────────────────────────────── */

/** La configuracion de un elemento, sea cual sea. */
export interface ConfiguracionDeElemento {
  cuadroDeTexto?: ConfiguracionDeCuadroDeTexto;
  tituloDeSeccion?: ConfiguracionDeTituloDeSeccion;
  lineaDivisoria?: ConfiguracionDeLineaDivisoria;
  forma?: ConfiguracionDeForma;
  conexion?: ConfiguracionDeConexion;
}

/** Los objectId de los elementos, en el mismo sitio que su configuracion. */
export const ELEMENTOS = [
  'cuadro-de-texto',
  'titulo-de-seccion',
  'linea-divisoria',
  'forma',
  'conexion',
] as const;
export type IdDeElemento = (typeof ELEMENTOS)[number];

export const esElemento = (objectId: string): objectId is IdDeElemento =>
  (ELEMENTOS as readonly string[]).includes(objectId);

/** Los elementos que se dibujan SIN tarjeta. */
export const SIN_TARJETA: readonly string[] = [
  'linea-divisoria',
  'conexion',
  'titulo-de-seccion',
  'forma',
];

/** Grosor util de una linea, acotado. Mas de esto deja de leerse como linea. */
export const grosorValido = (grosor: number | undefined): number =>
  Math.min(8, Math.max(1, Math.round(grosor ?? 1)));

/** El trazo CSS de un estilo de linea. */
export const trazoDeLinea = (estilo: EstiloDeLinea | undefined): string =>
  estilo === 'discontinua' ? 'dashed' : estilo === 'punteada' ? 'dotted' : 'solid';
