import type { Aggregation, FieldRef, QueryResult } from '@app/data-contracts';
import { aggregateBy, fieldKey } from './viewModel';
import type { ObjectInstance } from './types';

/**
 * Lo que los tres complementos de vista —filtro, pie y paginado— hacen con los datos.
 *
 * Vive aqui y no en los componentes por el mismo motivo que la proyeccion: es logica sin pantalla,
 * y sin pantalla se prueba con una tabla de entrada y otra de salida. Metida en un componente
 * habria que montar un navegador para comprobar que el paginado cuenta bien las paginas.
 */

/**
 * Las claves con las que la seleccion de cada complemento viaja en la URL (4.11).
 *
 * Llevan el `instanceId` DELANTE y no el nombre del campo, que seria lo obvio: un filtro de
 * visualizacion acota su objeto y solo el suyo, asi que dos objetos filtrados por la misma
 * dimension tienen que poder estar en valores distintos. Con la clave del campo se pisarian, y
 * filtrar uno moveria el otro — que es precisamente lo que este complemento NO es.
 */
const PREFIJO_FILTRO = 'f.';
const PREFIJO_PAGINA = 'p.';

export const visualFilterKey = (instanceId: string): string => `${PREFIJO_FILTRO}${instanceId}`;
export const paginationKey = (instanceId: string): string => `${PREFIJO_PAGINA}${instanceId}`;

/**
 * true si la clave es de un complemento y no un filtro de la PAGINA.
 *
 * Existe para que la linea de «filtros aplicados» del modulo no las recite: son estado de un
 * objeto, no una eleccion sobre el modulo, y ensenarlas ahi —con su clave interna delante— invita
 * a leer un recorte de una tarjeta como si acotara la pagina entera.
 *
 * Los dos prefijos llevan punto porque una clave de campo es `Tabla.Campo`: para chocar con uno
 * de estos haria falta una tabla llamada exactamente `f` o `p`.
 */
export const attachmentKeyIs = (clave: string): boolean =>
  clave.startsWith(PREFIJO_FILTRO) || clave.startsWith(PREFIJO_PAGINA);

/** Los valores distintos de un campo, en el orden en que aparecen. */
export function visualFilterOptions(result: QueryResult, fieldName: string): string[] {
  const i = result.columns.findIndex((c) => c.name === fieldName);
  if (i < 0) return [];
  const vistos = new Set<string>();
  for (const row of result.rows) {
    const valor = row[i];
    if (valor !== null && valor !== undefined) vistos.add(String(valor));
  }
  return [...vistos];
}

/** Las filas que quedan tras aplicar la seleccion del filtro de visualizacion. */
export function applyVisualFilter(
  result: QueryResult,
  fieldName: string,
  valores: string[],
): QueryResult {
  if (valores.length === 0) return result;
  const i = result.columns.findIndex((c) => c.name === fieldName);
  if (i < 0) return result;
  const elegidos = new Set(valores);
  return { ...result, rows: result.rows.filter((row) => elegidos.has(String(row[i]))) };
}

/** Lo que el paginado sabe de si mismo, y lo unico que su control necesita para dibujarse. */
export interface PaginationView {
  /** La pagina que se mira, empezando en 1. */
  pagina: number;
  paginas: number;
  /** El primer y el ultimo registro visibles, en base 1, para la coletilla. */
  desde: number;
  hasta: number;
  total: number;
}

/**
 * Parte lo que el objeto ensena en paginas del tamano elegido.
 *
 * La UNIDAD es la combinacion distinta de las dimensiones mapeadas, no la fila de origen. Es lo
 * que hace que el mismo complemento sirva para una tabla —donde cada combinacion es un registro—
 * y para un grafico —donde cada una es una categoria—, que es como se pidio. Contando filas de
 * origen, un grafico de cuatro barras alimentado por cuatrocientas filas diria «pagina 1 de 40»
 * ensenando las cuatro barras siempre.
 */
export function paginate(
  result: QueryResult,
  dimensions: FieldRef[],
  porPagina: number,
  pagina: number,
): { result: QueryResult; vista: PaginationView } {
  const indices = dimensions.map((d) => result.columns.findIndex((c) => c.name === fieldKey(d)));
  const clave = (row: unknown[]): string =>
    indices.map((i) => (i >= 0 ? String(row[i] ?? '') : '')).join('');

  const orden: string[] = [];
  const vistos = new Set<string>();
  for (const row of result.rows) {
    const k = clave(row);
    if (!vistos.has(k)) {
      vistos.add(k);
      orden.push(k);
    }
  }

  const tamano = Math.max(1, Math.trunc(porPagina));
  const total = orden.length;
  const paginas = Math.max(1, Math.ceil(total / tamano));
  // Una pagina fuera de rango se recorta en vez de dejar el objeto vacio: la URL la escribe
  // cualquiera, y un objeto en blanco no dice «esa pagina no existe», dice «no hay datos».
  const actual = Math.min(Math.max(1, Math.trunc(pagina)), paginas);

  const inicio = (actual - 1) * tamano;
  const enLaPagina = new Set(orden.slice(inicio, inicio + tamano));

  return {
    result: { ...result, rows: result.rows.filter((row) => enLaPagina.has(clave(row))) },
    vista: {
      pagina: actual,
      paginas,
      desde: total === 0 ? 0 : inicio + 1,
      hasta: Math.min(inicio + tamano, total),
      total,
    },
  };
}

/** La coletilla, ya redactada. Se escribe aqui para que diga lo mismo dibujada y exportada. */
export const paginationLegend = (vista: PaginationView): string =>
  vista.total === 0
    ? 'Sin registros.'
    : `Registros del ${vista.desde} al ${vista.hasta}. Total ${vista.total}.`;

/** Las referencias `{{n}}` que un texto de pie contiene, en orden de aparicion. */
export function footerReferences(texto: string): number[] {
  return [...texto.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
}

/**
 * El pie de pagina, con sus referencias ya sustituidas.
 *
 * `{{1}}` es la PRIMERA MEDIDA MAPEADA, no una medida llamada «1» ni la primera columna. Se
 * referencia por orden de mapeo a proposito: el nombre de una medida puede cambiar en el esquema,
 * y un pie que la nombrara se quedaria escribiendo una columna que ya no existe. El orden lo fija
 * quien configura el objeto, y mientras no lo cambie el pie sigue diciendo lo mismo.
 */
export function footerText(
  texto: string,
  instance: ObjectInstance,
  result: QueryResult,
  aggregations: Aggregation[],
  format?: (medida: string, valor: number | null) => string,
): string {
  const measures = instance.binding.measures;
  if (footerReferences(texto).length === 0) return texto;

  // Sin dimensiones hay UN grupo: el total de cada medida sobre lo que el objeto tiene delante.
  // Delante, no en el dataset: un pie bajo un objeto filtrado tiene que decir la cifra filtrada.
  const totales = aggregateBy(result, [], measures, aggregations).rows[0]?.values ?? [];

  return texto.replace(/\{\{\s*(\d+)\s*\}\}/g, (entero, digitos: string) => {
    const posicion = Number(digitos);
    const medida = measures[posicion - 1];
    if (medida === undefined) return entero;
    const valor = totales[posicion - 1];
    const numero = typeof valor === 'number' ? valor : null;
    return format ? format(medida, numero) : String(numero ?? '');
  });
}
