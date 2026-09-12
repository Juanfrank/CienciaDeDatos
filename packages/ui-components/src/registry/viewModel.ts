import type { Agregacion, QueryResult } from '@app/data-contracts';
import { type Acumulador, acumular, cerrar, nuevoAcumulador } from './agregacion';
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

/**
 * Una combinacion distinta de dimensiones, con sus medidas ya resumidas.
 *
 * `null` en un valor significa «no hay respuesta», no cero: es lo que devuelve una medida que la
 * fuente ya calculo (`ninguna`) cuando al grupo llegan varias filas. Sumarlas o quedarse con la
 * primera seria inventar un numero, y 4.2 manda marcar, no disimular.
 */
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

/**
 * Agrupa las filas por las dimensiones pedidas y resume las medidas CON SU OPERADOR.
 *
 * `agregaciones` va alineada con `measures`, una por medida. Antes no existia y aqui habia un
 * `+`: sumaba siempre, asi que una columna de promedios se mostraba como la suma de sus
 * promedios. El operador no se deduce del nombre de la columna ni se adivina — lo declara el
 * esquema de la fuente y lo puede cambiar quien edita, desde el pozo.
 *
 * La agregacion ocurre aqui, sobre el dataset ya cacheado, y no generando una consulta nueva:
 * es la aplicacion directa de 6.6 -- "un modulo que necesita una vista mas especifica de un
 * dataset ya cacheado debe resolverla filtrando o agregando sobre el, en el backend".
 *
 * Devuelve las etiquetas SEPARADAS, una por dimension. Componerlas en una sola cadena es cosa de
 * quien dibuja: un grafico quiere "Norte / Penal" en el eje, pero una tabla quiere dos columnas
 * que se puedan ordenar por separado.
 */
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
   *
   * Es el caso de la tarjeta, que colapsa el dataset entero en un numero. Sin sembrarlo, un
   * dataset vacio no producia ningun grupo y el resultado era «no hay respuesta» para cualquier
   * operador — cuando la suma de un conjunto vacio es cero y solo el promedio es indefinido.
   * Dejando que el acumulador vacio decida, cada operador responde lo suyo.
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

/**
 * Vista categorica: lo mismo que `aggregateBy`, con las etiquetas ya compuestas para un eje.
 *
 * Delega en `aggregateBy` a proposito. Con dos implementaciones de la agregacion, un grafico y
 * la exportacion del mismo objeto podrian acabar dando numeros distintos.
 */
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

/**
 * Resume la medida principal sobre todas las filas visibles, con SU operador.
 *
 * Una tarjeta colapsa el dataset entero en un numero, asi que es donde mas se notaba el fallo:
 * `DiasPromedioResolucion` sobre 64 filas daba 10 593 dias (la suma de 64 promedios) en vez de
 * 165,5. Delega en `aggregateBy` sin dimensiones —que es exactamente «un solo grupo»— para no
 * tener una segunda implementacion del promedio que pueda separarse de la de los graficos.
 */
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

/**
 * Cruza dos dimensiones con una medida. La primera va en filas; la segunda, en columnas.
 *
 * Los totales se acumulan DESDE LAS FILAS DE ORIGEN, no desde las celdas ya calculadas. Con la
 * suma daba igual —la suma de las celdas es la suma total—, pero con cualquier otro operador no:
 * el promedio de una fila es el promedio de sus registros, no el promedio de los promedios de sus
 * celdas, que solo coincide si todas las celdas pesan lo mismo. Por eso cada fila de origen
 * alimenta cuatro acumuladores a la vez: su celda, su total de fila, su total de columna y el
 * total general.
 */
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
