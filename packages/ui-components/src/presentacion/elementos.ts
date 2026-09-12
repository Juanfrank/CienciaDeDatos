import type { Alineacion, ColorDeTexto, EstiloDeTexto } from './contrato';

/**
 * Elementos: los objetos que NO se enlazan a un origen de datos.
 *
 * Un modulo no es solo una rejilla de cifras. Hay que poder decir donde empieza una seccion,
 * separar dos bloques, poner una nota, senalar que un cuadro alimenta a otro. Hasta ahora todo eso
 * habia que resolverlo con un titulo de objeto vacio o no resolverlo, y la consecuencia era que
 * los modulos largos se leian como una lista plana de tarjetas sin jerarquia visible.
 *
 * Se publican como objetos del catalogo, igual que un grafico, y por el mismo motivo: asi llevan
 * version fijada (4.5), se colocan con el mismo arrastre, se validan con la misma comprobacion y
 * se personalizan con los mismos textos. Lo unico que los distingue es que su contrato de datos
 * admite cero dimensiones y cero medidas — y de ahi se DEDUCE que no necesitan dataset, en vez de
 * llevar un interruptor aparte que alguien pueda dejar desincronizado.
 */

/* ── Cuadro de texto ───────────────────────────────────────────────────────────────────────── */

/**
 * Texto con formato, escrito a mano.
 *
 * El contenido se guarda como una lista de parrafos y no como HTML: HTML pegado desde fuera
 * traeria estilos ajenos al tema, y guardarlo obligaria a sanearlo en cada lectura. Con parrafos y
 * marcas explicitas, lo que se puede escribir es exactamente lo que el tema sabe dibujar.
 *
 * `campos` queda reservado para el enlace futuro a un dataset: un parrafo podra intercalar el
 * valor de una medida. Hoy no se ofrece en el editor, pero el hueco esta en el modelo para que
 * anadirlo no obligue a migrar lo ya guardado.
 */
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

/**
 * Donde estan las lineas de un titulo de seccion.
 *
 * `ambos` es horizontal —izquierda y derecha del texto—, que es el titulo centrado clasico. Las
 * lineas se adaptan al espacio: no miden un fijo, se reparten lo que sobra despues del texto, de
 * modo que el mismo titulo funciona en seis columnas y en doce sin volver a configurarlo.
 */
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

/**
 * Una linea, sola.
 *
 * Se coloca en el hueco entre celdas de la rejilla —una fila de alto uno, o una columna de ancho
 * uno— y se centra dentro de el. Por eso no lleva tarjeta ni cabecera: una linea con borde,
 * sombra y titulo deja de separar y pasa a ser un objeto mas que separar.
 */
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

/**
 * Una forma basica.
 *
 * El relleno y el trazo son ROLES del tema, no colores sueltos, por el mismo motivo que en
 * cualquier otro sitio (4.3): un hex escrito a mano no tiene par de contraste comprobado contra la
 * superficie donde acabe, ni sigue al tema oscuro.
 *
 * `cuadrado` y `circulo` se dibujan con lado igual al MENOR de los dos ejes y centrados: si se
 * estiraran para llenar la celda dejarian de ser lo que su nombre dice.
 */
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

/**
 * Un conector de diagrama entre dos objetos del modulo.
 *
 * Guarda los IDS de los dos objetos, NUNCA coordenadas. Es la diferencia entre un conector y una
 * linea dibujada encima: si guardara puntos, mover o redimensionar cualquiera de los dos extremos
 * lo dejaria apuntando al aire, y ese es exactamente el fallo que hace que los diagramas de las
 * herramientas de oficina se rompan en cuanto alguien toca la disposicion.
 *
 * El trazado se RECALCULA en cada render a partir de la caja de los dos objetos, asi que sigue
 * pegado por construccion y no por acordarse de actualizarlo.
 */
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

/**
 * La configuracion de un elemento, sea cual sea.
 *
 * Un solo campo opcional por tipo, y no un campo generico `config: unknown`: asi el editor y el
 * renderizador comparten el tipo exacto de cada uno, y anadir un elemento nuevo es un error de
 * compilacion en los sitios que hay que tocar en vez de un `any` que pasa desapercibido.
 */
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

/**
 * Los elementos que se dibujan SIN tarjeta.
 *
 * Una linea divisoria o un conector con borde, fondo y sombra dejan de separar y de conectar: son
 * trazos, no bloques. El titulo de seccion tampoco la lleva porque su trabajo es encabezar lo que
 * viene debajo, y una caja alrededor lo convertiria en un bloque mas.
 */
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
