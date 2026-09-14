import type { ObjectCategory } from '../registry/types';

/**
 * El tamano con el que un objeto entra en la rejilla.
 *
 * Hasta ahora todos entraban 6x3, del titulo de seccion a la matriz. Un titulo ocupaba media
 * pagina para dibujar una linea de texto, y una tabla de doce columnas nacia con sitio para
 * cuatro: lo primero que hacia quien editaba era redimensionar lo que acababa de colocar.
 *
 * No es un minimo que se imponga: se puede achicar o agrandar despues, y la validacion de la
 * rejilla es la misma de siempre. Es la talla razonable de salida, deducida de lo que el objeto
 * YA DECLARA —su categoria y cuantos campos admite— y no de una tabla escrita a mano que habria
 * que acordarse de ampliar con cada objeto nuevo.
 */

export interface DefaultSize {
  /** Columnas de las doce de la rejilla. */
  w: number;
  /** Filas de la rejilla. */
  h: number;
}

/**
 * Lo minimo que hay que saber de un objeto para darle una talla.
 *
 * No pide la definicion entera del catalogo a proposito: la paleta del editor trabaja con una
 * forma reducida —sin versiones ni certificacion— y es ella quien coloca. Pedir mas obligaria a
 * la paleta a arrastrar datos que no usa.
 */
export interface SizeableObject {
  objectId: string;
  category: ObjectCategory;
  /** Cuantas dimensiones admite. En el catalogo es `dataContract.dimensions`. */
  dimensiones: { min: number; max: number };
  /** Cuantas medidas admite. En el catalogo es `dataContract.measures`. */
  medidas: { min: number; max: number };
}

/** Lo ancha que es la rejilla, para no proponer nada que no quepa. */
const GRID_COLUMNS = 12;

/**
 * Objetos cuya forma no se deduce de su contrato de datos.
 *
 * Todos declaran cero dimensiones y cero medidas, asi que la regla general los trataria igual, y
 * no se parecen en nada: una linea divisoria cruza la pagina y es plana; una forma es un cuadrado.
 * Son pocos y no crecen: cada uno dice por que es asi.
 */
const POR_FORMA: Record<string, DefaultSize> = {
  // Cruza el ancho para separar dos bloques; su alto es el de una linea.
  'linea-divisoria': { w: 12, h: 1 },
  // Encabeza una seccion: ancho completo y una sola fila de texto.
  'titulo-de-seccion': { w: 12, h: 1 },
  // Un parrafo o dos. Ni cruza la pagina ni cabe en una celda.
  'cuadro-de-texto': { w: 4, h: 2 },
  // Cuadrada de salida: es lo que hace que un cuadrado se vea cuadrado.
  forma: { w: 2, h: 2 },
  // Une dos objetos: nace pequena y se estira hasta donde haga falta.
  conexion: { w: 2, h: 2 },
  /*
   * El expandible nace como lo que es cerrado: una fila.
   *
   * Por su categoria le tocarian las cuatro filas de un contenedor, y nacer reservando cuatro
   * filas vacias es justo lo contrario de un chiclet. Lo que ocupa abierto lo decide su propia
   * configuracion, no esta talla.
   */
  'contenedor-expandible': { w: 12, h: 1 },
};

/**
 * Por categoria, cuando el contrato de datos no basta.
 *
 * Un contenedor no declara datos —los declaran los objetos de dentro— y aun asi necesita sitio
 * para una rejilla propia; un complemento se adjunta y no ocupa celdas por si mismo.
 */
const POR_CATEGORIA: Partial<Record<ObjectCategory, DefaultSize>> = {
  // Una cifra y su etiqueta. Admite una dimension opcional para desglosar, y aun asi lo que se
  // lee es un numero: por el contrato saldria del tamano de un grafico.
  indicador: { w: 3, h: 2 },
  contenedor: { w: 6, h: 4 },
  complemento: { w: 4, h: 3 },
  filtro: { w: 3, h: 3 },
  mapa: { w: 6, h: 4 },
};

/**
 * Un objeto con datos: el ancho crece con las dimensiones que admite, el alto con las medidas.
 *
 * Es la traduccion directa de lo que se lee en pantalla. Cada dimension mas es una categoria mas
 * que cabe en el eje, y ahi es donde se necesita ancho; cada medida mas es una serie mas, y eso
 * pide alto para la leyenda y para que las series no se pisen.
 *
 * Se parte del minimo que el objeto exige, no del maximo: un objeto recien colocado tiene el
 * mapeo minimo, y darle sitio para un maximo que todavia no usa deja media pagina en blanco.
 */
function porContrato(objeto: SizeableObject): DefaultSize {
  const dimensiones = Math.max(objeto.dimensiones.min, 1);
  const medidas = Math.max(objeto.medidas.min, 1);
  const categoria = objeto.category;

  // Una cifra sola no necesita eje: es el caso del medidor.
  if (objeto.dimensiones.max === 0) return { w: 3, h: 2 };

  // Se lee fila a fila, asi que lo que le falta siempre es ALTO, no ancho.
  if (categoria === 'tabla') return { w: GRID_COLUMNS, h: 4 + Math.min(dimensiones, 2) };

  const w = Math.min(GRID_COLUMNS, 4 + dimensiones * 2);
  const h = 3 + (medidas >= 2 ? 1 : 0);
  return { w, h };
}

/** El tamano con el que este objeto entra en la rejilla. */
export function defaultSize(objeto: SizeableObject): DefaultSize {
  const porForma = POR_FORMA[objeto.objectId];
  if (porForma) return porForma;

  const porCategoria = POR_CATEGORIA[objeto.category];
  if (porCategoria) return porCategoria;

  return porContrato(objeto);
}
