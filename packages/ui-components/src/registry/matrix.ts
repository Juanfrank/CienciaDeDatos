import type { Aggregation, QueryResult } from '@app/data-contracts';
import { type Accumulator, acumular, close, newAccumulator } from './aggregation';
import { fieldKey } from './viewModel';

/** La matriz, con jerarquia de verdad. */

/** Separador interno de rutas. No aparece en ninguna etiqueta visible. */
const SEP = '||';
/** Separa la ruta de fila de la de columna dentro de la misma clave. */
const CRUCE = '<>';

export const pathKey = (path: readonly string[]): string => path.join(SEP);

const cellKey = (fila: readonly string[], column: readonly string[]): string =>
  `${pathKey(fila)}${CRUCE}${pathKey(column)}`;

export interface MatrixNode {
  /** Etiquetas desde la raiz hasta este nodo, incluida la suya. */
  path: string[];
  etiqueta: string;
  /** 0 para el primer nivel. */
  nivel: number;
  hijos: MatrixNode[];
}

export interface HierarchicalMatrix {
  dataRows: MatrixNode[];
  gridColumns: MatrixNode[];
  medidas: string[];
  /** Nombre de la dimension de cada nivel, para rotular la esquina y las cabeceras. */
  rowLevels: string[];
  columnLevels: string[];
  /**
   * Valor de una combinacion. Rutas vacias son el total general.
   * `null` significa que esa combinacion no tiene filas de origen, que no es lo mismo que cero.
   */
  valor(rutaFila: readonly string[], rutaColumna: readonly string[], medida: number): number | null;
}

function insertar(raiz: MatrixNode[], labels: string[]): void {
  let nivel = raiz;
  const path: string[] = [];
  for (const [i, etiqueta] of labels.entries()) {
    path.push(etiqueta);
    let node = nivel.find((n) => n.etiqueta === etiqueta);
    if (!node) {
      node = { path: [...path], etiqueta, nivel: i, hijos: [] };
      nivel.push(node);
    }
    nivel = node.hijos;
  }
}

export function buildMatrix(
  result: QueryResult,
  rowDimensions: { table: string; field: string }[],
  columnDimensions: { table: string; field: string }[],
  medidas: string[],
  aggregations: Aggregation[],
): HierarchicalMatrix {
  const indice = (d: { table: string; field: string }) =>
    result.columns.findIndex((c) => c.name === fieldKey(d));
  const rowI = rowDimensions.map(indice);
  const columnI = columnDimensions.map(indice);
  const measureI = medidas.map((m) => result.columns.findIndex((c) => c.name === m));

  const dataRows: MatrixNode[] = [];
  const gridColumns: MatrixNode[] = [];
  const celdas = new Map<string, Accumulator[]>();

  const acumuladoresDe = (clave: string): Accumulator[] => {
    let accs = celdas.get(clave);
    if (!accs) {
      accs = medidas.map((_, i) => newAccumulator(aggregations[i] ?? 'suma'));
      celdas.set(clave, accs);
    }
    return accs;
  };

  for (const fila of result.rows) {
    const labelRow = rowI.map((i) => (i >= 0 ? String(fila[i]) : '(sin dato)'));
    const labelColumn = columnI.map((i) => (i >= 0 ? String(fila[i]) : '(sin dato)'));
    insertar(dataRows, labelRow);
    insertar(gridColumns, labelColumn);

    /*
     * Cada fila de origen alimenta su celda Y la de todos sus niveles por encima.
     */
    for (let f = 0; f <= labelRow.length; f += 1) {
      const rowPrefix = labelRow.slice(0, f);
      for (let c = 0; c <= labelColumn.length; c += 1) {
        const accs = acumuladoresDe(cellKey(rowPrefix, labelColumn.slice(0, c)));
        measureI.forEach((column, m) => {
          const acc = accs[m];
          if (acc && column >= 0) acumular(acc, fila[column]);
        });
      }
    }
  }

  return {
    dataRows,
    gridColumns,
    medidas,
    rowLevels: rowDimensions.map(fieldKey),
    columnLevels: columnDimensions.map(fieldKey),
    valor(rutaFila, rutaColumna, medida) {
      const acc = celdas.get(cellKey(rutaFila, rutaColumna))?.[medida];
      return acc ? close(acc) : null;
    },
  };
}

/** Las filas que se DIBUJAN, en orden, segun lo que este colapsado. */
export function visibleRows(
  nodos: MatrixNode[],
  colapsados: ReadonlySet<string>,
): MatrixNode[] {
  const salida: MatrixNode[] = [];
  const recorrer = (lista: MatrixNode[]) => {
    for (const node of lista) {
      salida.push(node);
      if (node.hijos.length > 0 && !colapsados.has(pathKey(node.path))) recorrer(node.hijos);
    }
  };
  recorrer(nodos);
  return salida;
}

/** Las hojas de un arbol de columnas: las que llevan cifras. Un nodo colapsado cuenta como hoja. */
export function leaves(nodos: MatrixNode[], colapsados: ReadonlySet<string>): MatrixNode[] {
  const salida: MatrixNode[] = [];
  const recorrer = (lista: MatrixNode[]) => {
    for (const node of lista) {
      if (node.hijos.length === 0 || colapsados.has(pathKey(node.path))) salida.push(node);
      else recorrer(node.hijos);
    }
  };
  recorrer(nodos);
  return salida;
}

export type Direction = 'asc' | 'desc';

/** Ordena una lista de nodos entre HERMANOS, sin romper la jerarquia. */
export function sortNodes(
  nodos: MatrixNode[],
  compare: (a: MatrixNode, b: MatrixNode) => number,
): MatrixNode[] {
  return [...nodos].sort(compare).map((n) => ({ ...n, hijos: sortNodes(n.hijos, compare) }));
}

/** Comparador de cifras: los huecos al final SIEMPRE, se ordene como se ordene. */
export function compareValues(a: number | null, b: number | null, direction: Direction): number {
  if (a === null && b === null) return 0;
  // Un hueco no es «lo mas pequeño»: es que no hay cifra. Se queda abajo en las dos direcciones,
  // porque lo contrario llena la cabecera de filas vacias en cuanto se invierte el orden.
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}
