import type { QueryResult } from './IDataConnector';

/**
 * Como se expresa un filtro, de la URL al dato — secciones 4.4 y 4.11.
 *
 * Vive en los CONTRATOS y no en la interfaz porque tiene que ser la misma regla en los dos sitios
 * donde se aplica: el lector del cache, en el servidor, y los complementos que acotan un objeto
 * solo, en el navegador. Con una copia en cada lado, «contiene» acabaria distinguiendo mayusculas
 * en uno y no en el otro, y nadie lo habria decidido.
 *
 * Hasta ahora solo existia UNA forma de filtrar —pertenecer a un conjunto de valores— y el panel
 * de filtros ofrecia ademas un rango de fechas que se escribia en la URL y no acotaba nada: sus
 * claves `campo.desde` y `campo.hasta` no son el nombre de ninguna columna, asi que el lector las
 * descartaba. Un control que no hace nada es peor que no tenerlo, porque quien lo mueve se queda
 * creyendo que ya filtro.
 */

/**
 * El sufijo con el que cada operador viaja en la URL.
 *
 * Sin sufijo es «pertenece a», que es lo que ya escribian el filtrado cruzado, los marcadores, el
 * drill-through y la exportacion: se conserva tal cual para no romper ninguna direccion guardada.
 */
export const FILTER_SUFFIXES = {
  /** No pertenece al conjunto. El complemento del de siempre. */
  excluye: 'no',
  /** El texto aparece en el valor, sin distinguir mayusculas ni acentos. */
  contiene: 'contiene',
  /** El valor empieza por el texto. */
  empieza: 'empieza',
  /** Extremo inferior del rango, inclusive. Numerico si la columna lo es. */
  desde: 'desde',
  /** Extremo superior del rango, inclusive. */
  hasta: 'hasta',
  /** `si` deja solo lo vacio; `no`, solo lo que tiene valor. */
  vacio: 'vacio',
} as const;

export type FilterSuffix = (typeof FILTER_SUFFIXES)[keyof typeof FILTER_SUFFIXES];

const SUFIJOS = new Set<string>(Object.values(FILTER_SUFFIXES));

/** Lo que se pide sobre UN campo. Todo lo que traiga se cumple a la vez. */
export interface FieldFilter {
  field: string;
  /** Pertenece a. Vacio quiere decir «no se pidio», no «ninguno». */
  incluye: string[];
  excluye: string[];
  contiene?: string;
  empieza?: string;
  desde?: string;
  hasta?: string;
  vacio?: boolean;
}

const vacio = (field: string): FieldFilter => ({ field, incluye: [], excluye: [] });

/** true si el filtro no pide nada: aplicarlo no quitaria ninguna fila. */
export const filterIsEmpty = (f: FieldFilter): boolean =>
  f.incluye.length === 0 &&
  f.excluye.length === 0 &&
  f.contiene === undefined &&
  f.empieza === undefined &&
  f.desde === undefined &&
  f.hasta === undefined &&
  f.vacio === undefined;

const listOf = (valor: string | string[] | undefined): string[] =>
  valor === undefined ? [] : Array.isArray(valor) ? valor : [valor];

const first = (valor: string | string[] | undefined): string | undefined => {
  const lista = listOf(valor).filter((v) => v !== '');
  return lista[0];
};

/**
 * Parte la clave `Campo.sufijo` en las dos cosas.
 *
 * Una clave de campo es `Tabla.Campo`, asi que se mira el ULTIMO segmento y solo cuenta si es uno
 * de los sufijos conocidos: `DimTiempo.Trimestre` no se convierte en un filtro sobre `DimTiempo`
 * por tener un punto.
 */
export function splitFilterKey(clave: string): { field: string; suffix?: FilterSuffix } {
  const corte = clave.lastIndexOf('.');
  if (corte <= 0) return { field: clave };
  const posible = clave.slice(corte + 1);
  if (!SUFIJOS.has(posible)) return { field: clave };
  return { field: clave.slice(0, corte), suffix: posible as FilterSuffix };
}

/**
 * Lee de la query string lo que se pide sobre cada campo.
 *
 * Lo que no reconoce se ignora en silencio A PROPOSITO: en la misma query viajan el cromo de la
 * vista incrustada, la pagina abierta y el estado de los complementos de cada objeto. Tratar
 * cualquier clave como un filtro convertiria `?pagina=graficos` en un filtro sobre una columna
 * llamada «pagina», que no existe, y no filtraria nada — o peor, si existiera.
 */
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): FieldFilter[] {
  const porCampo = new Map<string, FieldFilter>();
  const de = (field: string): FieldFilter => {
    const previo = porCampo.get(field);
    if (previo) return previo;
    const nuevo = vacio(field);
    porCampo.set(field, nuevo);
    return nuevo;
  };

  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined) continue;
    const { field, suffix } = splitFilterKey(clave);

    switch (suffix) {
      case undefined: {
        const valores = listOf(valor).filter((v) => v !== '');
        if (valores.length > 0) de(field).incluye.push(...valores);
        break;
      }
      case FILTER_SUFFIXES.excluye: {
        const valores = listOf(valor).filter((v) => v !== '');
        if (valores.length > 0) de(field).excluye.push(...valores);
        break;
      }
      case FILTER_SUFFIXES.contiene: {
        const texto = first(valor);
        if (texto !== undefined) de(field).contiene = texto;
        break;
      }
      case FILTER_SUFFIXES.empieza: {
        const texto = first(valor);
        if (texto !== undefined) de(field).empieza = texto;
        break;
      }
      case FILTER_SUFFIXES.desde: {
        const v = first(valor);
        if (v !== undefined) de(field).desde = v;
        break;
      }
      case FILTER_SUFFIXES.hasta: {
        const v = first(valor);
        if (v !== undefined) de(field).hasta = v;
        break;
      }
      case FILTER_SUFFIXES.vacio: {
        const v = first(valor);
        if (v === 'si') de(field).vacio = true;
        if (v === 'no') de(field).vacio = false;
        break;
      }
    }
  }

  return [...porCampo.values()].filter((f) => !filterIsEmpty(f));
}

/**
 * Normaliza para comparar texto: sin mayusculas y sin acentos.
 *
 * «Peña» y «Pena» se escriben de las dos maneras en los expedientes, y quien busca no sabe cual
 * quedo registrada. Un «contiene» que distinga acentos devuelve cero resultados y parece que no
 * hay datos.
 */
const plano = (valor: string): string =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Compara dos valores para un rango.
 *
 * NUMERICO cuando los dos son numeros, y de texto en cualquier otro caso. Comparando siempre como
 * texto, «10» quedaria antes que «9»; comparando siempre como numero, una fecha ISO se convertiria
 * en `NaN` y el rango no acotaria nada. Las fechas en ISO se ordenan bien como texto, que es
 * justamente por lo que se escriben asi.
 */
function compare(valor: string, limite: string): number {
  const a = Number(valor);
  const b = Number(limite);
  if (valor.trim() !== '' && limite.trim() !== '' && !Number.isNaN(a) && !Number.isNaN(b)) {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  return valor === limite ? 0 : valor < limite ? -1 : 1;
}

/** true si el valor de una celda cumple lo que el filtro pide. */
export function valueMatches(filtro: FieldFilter, celda: unknown): boolean {
  const esVacia = celda === null || celda === undefined || String(celda).trim() === '';
  if (filtro.vacio !== undefined && filtro.vacio !== esVacia) return false;

  const valor = esVacia ? '' : String(celda);

  if (filtro.incluye.length > 0 && !filtro.incluye.includes(valor)) return false;
  if (filtro.excluye.includes(valor)) return false;
  if (filtro.contiene !== undefined && !plano(valor).includes(plano(filtro.contiene))) return false;
  if (filtro.empieza !== undefined && !plano(valor).startsWith(plano(filtro.empieza))) return false;

  // Una celda vacia no entra en ningun rango: no es que valga cero, es que no dice nada, y
  // colarla en «hasta 2024» seria afirmar algo que el expediente no dice.
  if (filtro.desde !== undefined && (esVacia || compare(valor, filtro.desde) < 0)) return false;
  if (filtro.hasta !== undefined && (esVacia || compare(valor, filtro.hasta) > 0)) return false;

  return true;
}

/**
 * Aplica sobre un resultado ya leido lo que se pidio.
 *
 * Un filtro sobre una columna que el resultado NO trae se ignora en vez de vaciarlo. Vaciarlo
 * diria «no hay datos» cuando lo que pasa es que la direccion menciona un campo que este objeto no
 * ensena — y en una pagina, cada objeto trae sus propias columnas.
 */
export function applyFilters(result: QueryResult, filtros: FieldFilter[]): QueryResult {
  const activos = filtros
    .map((filtro) => ({
      filtro,
      index: result.columns.findIndex((c) => c.name === filtro.field),
    }))
    .filter((f) => f.index >= 0 && !filterIsEmpty(f.filtro));

  if (activos.length === 0) return result;

  return {
    ...result,
    rows: result.rows.filter((row) =>
      activos.every(({ filtro, index }) => valueMatches(filtro, row[index])),
    ),
  };
}
