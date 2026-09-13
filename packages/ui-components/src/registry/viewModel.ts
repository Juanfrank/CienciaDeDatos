import type { Agregacion, QueryResult } from '@app/data-contracts';
import { type Acumulador, acumular, cerrar, nuevoAcumulador } from './agregacion';
import type { ObjectDataContract, ObjectInstance } from './types';

/** Transformacion de un QueryResult en los datos que un objeto necesita para dibujarse. */

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
 */
export function validateBinding(
  instance: ObjectInstance,
  contract: ObjectDataContract,
  availableColumns: string[],
): BindingProblem[] {
  const problems: BindingProblem[] = [];
  const disponibles = new Set(availableColumns);
  const { dimensions, measures } = instance.binding;

  if (dimensions.length < contract.dimensions.min || dimensions.length > contract.dimensions.max) {
    problems.push({
      slot: 'dimensiones',
      kind: 'contrato-incumplido',
      problem:
        `El objeto admite entre ${contract.dimensions.min} y ${contract.dimensions.max} ` +
        `dimensiones, y el mapeo declara ${dimensions.length}.`,
    });
  }

  if (measures.length < contract.measures.min || measures.length > contract.measures.max) {
    problems.push({
      slot: 'medidas',
      kind: 'contrato-incumplido',
      problem:
        `El objeto admite entre ${contract.measures.min} y ${contract.measures.max} medidas, ` +
        `y el mapeo declara ${measures.length}.`,
    });
  }

  for (const dim of dimensions) {
    if (!disponibles.has(fieldKey(dim))) {
      problems.push({
        slot: fieldKey(dim),
        kind: 'campo-inexistente',
        problem: `La dimension '${fieldKey(dim)}' ya no existe en el dataset que alimenta este objeto.`,
      });
    }
  }

  for (const medida of measures) {
    if (!disponibles.has(medida)) {
      problems.push({
        slot: medida,
        kind: 'campo-inexistente',
        problem: `La medida '${medida}' ya no existe en el dataset que alimenta este objeto.`,
      });
    }
  }

  return problems;
}

export interface CategoryPoint {
  /** Etiqueta de la categoria, ya compuesta si hay mas de una dimension. */
  label: string;
  /** `null` es un hueco: la medida no se puede resumir a este grano. ECharts lo dibuja sin punto. */
  values: (number | null)[];
}

export interface CategoricalViewModel {
  /** Nombre de cada serie, en el mismo orden que `values`. */
  series: string[];
  points: CategoryPoint[];
  /** true si se agregaron filas: el dataset tenia mas granularidad de la que el objeto muestra. */
  aggregated: boolean;
}

/** Separador interno de claves compuestas. No aparece en ninguna etiqueta visible. */
const SEP = '||';

/** Una combinacion distinta de dimensiones, con sus medidas ya resumidas. */
export interface AggregatedRow {
  /** Un valor por dimension, en el orden del mapeo. Sin componer en una sola cadena. */
  labels: string[];
  values: (number | null)[];
}

export interface AggregatedRows {
  rows: AggregatedRow[];
  /** true si se combinaron filas: el dataset traia mas granularidad de la que el objeto muestra. */
  aggregated: boolean;
}

/** Agrupa las filas por las dimensiones pedidas y resume las medidas CON SU OPERADOR. */
export function aggregateBy(
  result: QueryResult,
  dimensions: { table: string; field: string }[],
  measures: string[],
  agregaciones: Agregacion[],
): AggregatedRows {
  const indiceDim = dimensions.map((d) => result.columns.findIndex((c) => c.name === fieldKey(d)));
  const indiceMed = measures.map((m) => result.columns.findIndex((c) => c.name === m));
  const operador = (i: number): Agregacion => agregaciones[i] ?? 'suma';

  const acumulado = new Map<string, { labels: string[]; accs: Acumulador[] }>();
  let filasAgregadas = 0;

  /*
   * Sin dimensiones hay UN grupo, lo traiga filas o no.
   */
  if (dimensions.length === 0) {
    acumulado.set('', { labels: [], accs: measures.map((_, i) => nuevoAcumulador(operador(i))) });
  }

  for (const row of result.rows) {
    const labels = indiceDim.map((i) => (i >= 0 ? String(row[i]) : '(sin dato)'));
    const clave = labels.join(SEP);
    let grupo = acumulado.get(clave);
    if (grupo) {
      filasAgregadas++;
    } else {
      grupo = { labels, accs: measures.map((_, i) => nuevoAcumulador(operador(i))) };
      acumulado.set(clave, grupo);
    }
    // Una medida que no esta entre las columnas no se acumula: su acumulador queda vacio y se
    // cierra a 0 o a null segun el operador, en vez de contar un cero por cada fila leida — que
    // habria hecho que un promedio sobre una columna ausente devolviera 0 en vez de nada.
    for (const [i, columna] of indiceMed.entries()) {
      const acc = grupo.accs[i];
      if (acc && columna >= 0) acumular(acc, row[columna]);
    }
  }

  return {
    rows: [...acumulado.values()].map((g) => ({ labels: g.labels, values: g.accs.map(cerrar) })),
    aggregated: filasAgregadas > 0,
  };
}

/** Vista categorica: lo mismo que `aggregateBy`, con las etiquetas ya compuestas para un eje. */
export function toCategorical(
  result: QueryResult,
  dimensions: { table: string; field: string }[],
  measures: string[],
  agregaciones: Agregacion[],
): CategoricalViewModel {
  const { rows, aggregated } = aggregateBy(result, dimensions, measures, agregaciones);

  return {
    series: measures,
    points: rows.map((f) => ({ label: f.labels.join(' / '), values: f.values })),
    aggregated,
  };
}

export interface KpiViewModel {
  /** `null` cuando la medida no se puede resumir al grano que la tarjeta muestra. */
  value: number | null;
  label: string;
  /** Variacion respecto de la medida de comparacion, si se mapeo una segunda. */
  delta?: { absolute: number; relative: number | null };
}

/** Resume la medida principal sobre todas las filas visibles, con SU operador. */
export function toKpi(
  result: QueryResult,
  measures: string[],
  label: string,
  agregaciones: Agregacion[],
): KpiViewModel {
  const { rows } = aggregateBy(result, [], measures, agregaciones);
  const valores = rows[0]?.values ?? [];

  const presente = (nombre: string | undefined, i: number): number | null => {
    if (!nombre) return null;
    if (result.columns.findIndex((c) => c.name === nombre) < 0) return null;
    return valores[i] ?? null;
  };

  const valor = presente(measures[0], 0);
  const base = presente(measures[1], 1);

  if (valor === null || base === null) return { value: valor, label };

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
  rowTotals: (number | null)[];
  columnTotals: (number | null)[];
  grandTotal: number | null;
}

/** Cruza dos dimensiones con una medida. La primera va en filas; la segunda, en columnas. */
export function toMatrix(
  result: QueryResult,
  dimensions: { table: string; field: string }[],
  measure: string,
  agregacion: Agregacion,
): MatrixViewModel {
  const [dimFila, dimColumna] = dimensions;
  const iFila = dimFila ? result.columns.findIndex((c) => c.name === fieldKey(dimFila)) : -1;
  const iCol = dimColumna ? result.columns.findIndex((c) => c.name === fieldKey(dimColumna)) : -1;
  const iMed = result.columns.findIndex((c) => c.name === measure);

  const filas: string[] = [];
  const columnas: string[] = [];
  const celdas = new Map<string, Acumulador>();
  const totalDeFila = new Map<string, Acumulador>();
  const totalDeColumna = new Map<string, Acumulador>();
  const general = nuevoAcumulador(agregacion);

  const enMapa = (mapa: Map<string, Acumulador>, clave: string): Acumulador => {
    let acc = mapa.get(clave);
    if (!acc) {
      acc = nuevoAcumulador(agregacion);
      mapa.set(clave, acc);
    }
    return acc;
  };

  for (const row of result.rows) {
    const f = iFila >= 0 ? String(row[iFila]) : '(sin dato)';
    const c = iCol >= 0 ? String(row[iCol]) : '(sin dato)';
    if (!filas.includes(f)) filas.push(f);
    if (!columnas.includes(c)) columnas.push(c);
    if (iMed < 0) continue;
    const valor = row[iMed];
    acumular(enMapa(celdas, `${f}${SEP}${c}`), valor);
    acumular(enMapa(totalDeFila, f), valor);
    acumular(enMapa(totalDeColumna, c), valor);
    acumular(general, valor);
  }

  const cerrarDe = (mapa: Map<string, Acumulador>, clave: string): number | null => {
    const acc = mapa.get(clave);
    return acc ? cerrar(acc) : null;
  };

  return {
    rowLabels: filas,
    columnLabels: columnas,
    cells: filas.map((f) => columnas.map((c) => cerrarDe(celdas, `${f}${SEP}${c}`))),
    rowTotals: filas.map((f) => cerrarDe(totalDeFila, f)),
    columnTotals: columnas.map((c) => cerrarDe(totalDeColumna, c)),
    grandTotal: result.rows.length === 0 || iMed < 0 ? null : cerrar(general),
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
