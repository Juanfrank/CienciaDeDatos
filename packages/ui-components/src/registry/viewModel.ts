import type { QueryResult } from '@app/data-contracts';
import type { ObjectDataContract, ObjectInstance } from './types';

/**
 * Transformacion de un QueryResult en los datos que un objeto necesita para dibujarse.
 *
 * Son funciones PURAS y es donde vive la logica que de verdad puede fallar: localizar columnas,
 * agregar cuando el dataset trae mas granularidad de la que el objeto muestra, y reaccionar a
 * un campo que ya no existe. Los componentes de React son envoltorios delgados sobre esto.
 *
 * Los objetos reciben filas YA leidas del cache y YA filtradas por el ambito de quien mira. No
 * conocen la fuente, ni la consulta, ni el conector activo.
 */

export const fieldKey = (ref: { table: string; field: string }): string =>
  `${ref.table}.${ref.field}`;

export interface BindingProblem {
  /** Ranura afectada: el campo mapeado que ya no se puede resolver. */
  slot: string;
  problem: string;
  /** Distingue "el campo desaparecio del esquema" de "el mapeo incumple el contrato". */
  kind: 'campo-inexistente' | 'contrato-incumplido';
}

/**
 * Valida el mapeo de una instancia contra el contrato del objeto y contra las columnas
 * realmente presentes en el dataset.
 *
 * Seccion 4.2: "si un campo mapeado ya no existe en el modelo, marcarlo visualmente roto, no
 * fallar en silencio". Por eso devuelve problemas en vez de lanzar: el editor tiene que poder
 * dibujar el objeto roto y senalarlo, no quedarse en blanco.
 */
export function validateBinding(
  instance: ObjectInstance,
  contract: ObjectDataContract,
  availableColumns: string[],
): BindingProblem[] {
  const problemas: BindingProblem[] = [];
  const disponibles = new Set(availableColumns);
  const { dimensions, measures } = instance.binding;

  if (dimensions.length < contract.dimensions.min || dimensions.length > contract.dimensions.max) {
    problemas.push({
      slot: 'dimensiones',
      kind: 'contrato-incumplido',
      problem:
        `El objeto admite entre ${contract.dimensions.min} y ${contract.dimensions.max} ` +
        `dimensiones, y el mapeo declara ${dimensions.length}.`,
    });
  }

  if (measures.length < contract.measures.min || measures.length > contract.measures.max) {
    problemas.push({
      slot: 'medidas',
      kind: 'contrato-incumplido',
      problem:
        `El objeto admite entre ${contract.measures.min} y ${contract.measures.max} medidas, ` +
        `y el mapeo declara ${measures.length}.`,
    });
  }

  for (const dim of dimensions) {
    if (!disponibles.has(fieldKey(dim))) {
      problemas.push({
        slot: fieldKey(dim),
        kind: 'campo-inexistente',
        problem: `La dimension '${fieldKey(dim)}' ya no existe en el dataset que alimenta este objeto.`,
      });
    }
  }

  for (const medida of measures) {
    if (!disponibles.has(medida)) {
      problemas.push({
        slot: medida,
        kind: 'campo-inexistente',
        problem: `La medida '${medida}' ya no existe en el dataset que alimenta este objeto.`,
      });
    }
  }

  return problemas;
}

export interface CategoryPoint {
  /** Etiqueta de la categoria, ya compuesta si hay mas de una dimension. */
  label: string;
  values: number[];
}

export interface CategoricalViewModel {
  /** Nombre de cada serie, en el mismo orden que `values`. */
  series: string[];
  points: CategoryPoint[];
  /** true si se agregaron filas: el dataset tenia mas granularidad de la que el objeto muestra. */
  aggregated: boolean;
}

const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Separador interno de claves compuestas. No aparece en ninguna etiqueta visible. */
const SEP = '||';

/**
 * Agrupa las filas por las dimensiones pedidas y suma las medidas.
 *
 * La agregacion ocurre aqui, sobre el dataset ya cacheado, y no generando una consulta nueva:
 * es la aplicacion directa de 6.6 -- "un modulo que necesita una vista mas especifica de un
 * dataset ya cacheado debe resolverla filtrando o agregando sobre el, en el backend".
 */
export function toCategorical(
  result: QueryResult,
  dimensions: { table: string; field: string }[],
  measures: string[],
): CategoricalViewModel {
  const indiceDim = dimensions.map((d) => result.columns.findIndex((c) => c.name === fieldKey(d)));
  const indiceMed = measures.map((m) => result.columns.findIndex((c) => c.name === m));

  const acumulado = new Map<string, number[]>();
  let filasAgregadas = 0;

  for (const row of result.rows) {
    const label = indiceDim.map((i) => (i >= 0 ? String(row[i]) : '(sin dato)')).join(' / ');
    const valores = indiceMed.map((i) => (i >= 0 ? toNumber(row[i]) : 0));
    const previo = acumulado.get(label);
    if (previo) {
      filasAgregadas++;
      acumulado.set(
        label,
        previo.map((v, i) => v + (valores[i] ?? 0)),
      );
    } else {
      acumulado.set(label, valores);
    }
  }

  return {
    series: measures,
    points: [...acumulado.entries()].map(([label, values]) => ({ label, values })),
    aggregated: filasAgregadas > 0,
  };
}

export interface KpiViewModel {
  value: number;
  label: string;
  /** Variacion respecto de la medida de comparacion, si se mapeo una segunda. */
  delta?: { absolute: number; relative: number | null };
}

/** Suma la medida principal sobre todas las filas visibles. */
export function toKpi(result: QueryResult, measures: string[], label: string): KpiViewModel {
  const [principal, comparacion] = measures;
  const suma = (nombre: string | undefined): number | null => {
    if (!nombre) return null;
    const i = result.columns.findIndex((c) => c.name === nombre);
    if (i < 0) return null;
    return result.rows.reduce((total, row) => total + toNumber(row[i]), 0);
  };

  const valor = suma(principal) ?? 0;
  const base = suma(comparacion);

  if (base === null) return { value: valor, label };

  return {
    value: valor,
    label,
    delta: {
      absolute: valor - base,
      // Dividir entre cero no da "crecimiento infinito": da una comparacion sin sentido.
      relative: base === 0 ? null : (valor - base) / base,
    },
  };
}

export interface MatrixViewModel {
  rowLabels: string[];
  columnLabels: string[];
  /** cells[fila][columna]. Celda nula significa que esa combinacion no tiene filas. */
  cells: (number | null)[][];
  rowTotals: number[];
  columnTotals: number[];
  grandTotal: number;
}

/** Cruza dos dimensiones con una medida. La primera va en filas; la segunda, en columnas. */
export function toMatrix(
  result: QueryResult,
  dimensions: { table: string; field: string }[],
  measure: string,
): MatrixViewModel {
  const [dimFila, dimColumna] = dimensions;
  const iFila = dimFila ? result.columns.findIndex((c) => c.name === fieldKey(dimFila)) : -1;
  const iCol = dimColumna ? result.columns.findIndex((c) => c.name === fieldKey(dimColumna)) : -1;
  const iMed = result.columns.findIndex((c) => c.name === measure);

  const filas: string[] = [];
  const columnas: string[] = [];
  const mapa = new Map<string, number>();

  for (const row of result.rows) {
    const f = iFila >= 0 ? String(row[iFila]) : '(sin dato)';
    const c = iCol >= 0 ? String(row[iCol]) : '(sin dato)';
    if (!filas.includes(f)) filas.push(f);
    if (!columnas.includes(c)) columnas.push(c);
    const clave = `${f}${SEP}${c}`;
    mapa.set(clave, (mapa.get(clave) ?? 0) + (iMed >= 0 ? toNumber(row[iMed]) : 0));
  }

  const cells = filas.map((f) => columnas.map((c) => mapa.get(`${f}${SEP}${c}`) ?? null));
  const rowTotals = cells.map((fila) => fila.reduce<number>((t, v) => t + (v ?? 0), 0));
  const columnTotals = columnas.map((_, i) =>
    cells.reduce<number>((t, fila) => t + (fila[i] ?? 0), 0),
  );

  return {
    rowLabels: filas,
    columnLabels: columnas,
    cells,
    rowTotals,
    columnTotals,
    grandTotal: rowTotals.reduce((t, v) => t + v, 0),
  };
}

/** Valores distintos de una dimension, para poblar un segmentador. */
export function toSlicerOptions(
  result: QueryResult,
  dimension: { table: string; field: string },
): string[] {
  const i = result.columns.findIndex((c) => c.name === fieldKey(dimension));
  if (i < 0) return [];
  return [...new Set(result.rows.map((row) => String(row[i])))].sort((a, b) => a.localeCompare(b));
}
