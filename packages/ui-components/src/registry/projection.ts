import type { Aggregation, QueryResult } from '@app/data-contracts';
import type { ObjectInstance } from './types';
import { buildMatrix, visibleRows, leaves } from './matrix';
import { aFieldRef } from '../presentation/wells';
import { aggregateBy, fieldKey, toCategorical, toSlicerOptions } from './viewModel';
import { binLabel, histogramOf } from '../charts/histogram';
import { boxesOf } from '../charts/boxplot';
import { gridOf, valueAt } from '../charts/heatmap';
import { flowsOf } from '../charts/sankey';

/** Proyeccion tabular de un objeto — la forma de tabla de LO QUE EL OBJETO MUESTRA. */

const columnNumber = (name: string) => ({ name, type: 'number' });
const columnText = (name: string) => ({ name, type: 'string' });

/** Etiqueta de la dimension (o dimensiones) que encabeza una proyeccion categorica. */
const dimensionsLabel = (instance: ObjectInstance): string =>
  instance.binding.dimensions.map(fieldKey).join(' / ') || 'Total';

function sameProvenance(result: QueryResult, columns: QueryResult['columns'], rows: unknown[][]): QueryResult {
  // `source` y `generatedAt` se conservan: una proyeccion no cambia de donde vino el dato ni
  // cuando se calculo, y 4.8 los necesita intactos rio abajo.
  return { columns, rows, source: result.source, generatedAt: result.generatedAt };
}

/**
 * @param agregaciones Un operador por medida, alineado con `instance.binding.measures`. Viaja
 * desde el servidor con el objeto: asi la tabla en pantalla, el complemento de datos y los cuatro
 * formatos de exportacion resumen con el MISMO operador. Resolverlo aqui por segunda vez seria
 * abrir la puerta a que lo exportado y lo mostrado dieran cifras distintas.
 */
export function projectObject(
  instance: ObjectInstance,
  result: QueryResult,
  aggregations: Aggregation[],
): QueryResult {
  const { dimensions, measures } = instance.binding;

  switch (instance.objectId) {
    case 'tarjeta-kpi': {
      // Una tarjeta muestra un numero (o dos, si hay comparacion). Eso es su proyeccion: una
      // fila. Volcar aqui las filas del dataset seria exportar algo que la tarjeta no muestra.
      //
      // Agregar sin ninguna dimension colapsa todo el dataset en una sola fila, resumida con el
      // operador de cada medida — que es exactamente lo que hace la tarjeta al dibujarse.
      const { rows } = aggregateBy(result, [], measures, aggregations);
      const valores = rows[0]?.values ?? measures.map(() => null);
      const columns = [columnText('Indicador'), ...measures.map(columnNumber)];
      return sameProvenance(result, columns, [
        [instance.title ?? instance.objectId, ...valores],
      ]);
    }

    case 'matriz': {
      /*
       * La misma matriz JERARQUICA que se dibuja, aplanada.
       */
      const nada = new Set<string>();
      const deRanura = (id: string): string[] | undefined => instance.binding.slots?.[id];
      const rowDims = (deRanura('filas') ?? dimensions.slice(0, 1).map(fieldKey)).map(aFieldRef);
      const columnDims = (deRanura('columnas') ?? dimensions.slice(1, 2).map(fieldKey)).map(
        aFieldRef,
      );
      const medidas = deRanura('valores') ?? measures;

      const vm = buildMatrix(result, rowDims, columnDims, medidas, aggregations);
      const sheetColumns = leaves(vm.gridColumns, nada);

      const columns = [
        columnText(vm.rowLevels.join(' / ') || dimensionsLabel(instance)),
        ...sheetColumns.flatMap((c) =>
          medidas.map((m) => columnNumber(medidas.length > 1 ? `${c.etiqueta} · ${m}` : c.etiqueta)),
        ),
        ...medidas.map((m) => columnNumber(medidas.length > 1 ? `Total · ${m}` : 'Total')),
      ];

      const cellsOf = (path: readonly string[]) => [
        ...sheetColumns.flatMap((c) => medidas.map((_, i) => vm.valor(path, c.path, i))),
        ...medidas.map((_, i) => vm.valor(path, [], i)),
      ];

      const rows: unknown[][] = visibleRows(vm.dataRows, nada).map((node) => [
        // La sangria del nivel viaja como texto: un CSV no tiene jerarquia, y sin ella las filas
        // de subtotal y las de detalle se leerian como si estuvieran al mismo nivel.
        `${'  '.repeat(node.nivel)}${node.etiqueta}`,
        ...cellsOf(node.path),
      ]);
      rows.push(['Total', ...cellsOf([])]);
      return sameProvenance(result, columns, rows);
    }

    case 'segmentador': {
      const dimension = dimensions[0];
      if (!dimension) return sameProvenance(result, [], []);
      const opciones = toSlicerOptions(result, dimension);
      return sameProvenance(
        result,
        [columnText(fieldKey(dimension))],
        opciones.map((v) => [v]),
      );
    }

    case 'tabla': {
      // La tabla conserva una columna por dimension, no la etiqueta compuesta: es lo que
      // muestra, y una sola columna "Distrito / Materia" no se puede ordenar ni filtrar.
      const { rows } = aggregateBy(result, dimensions, measures, aggregations);
      const columns = [
        ...dimensions.map((d) => columnText(fieldKey(d))),
        ...measures.map(columnNumber),
      ];
      return sameProvenance(
        result,
        columns,
        rows.map((f) => [...f.labels, ...f.values]),
      );
    }

    /*
     * Los cuatro que TRANSFORMAN antes de dibujar.
     *
     * La rama por defecto vuelca una fila por categoria del dataset, que para estos es una fila por
     * observacion: mil doscientos casos donde el objeto ensena doce intervalos. Es el mismo motivo
     * por el que la tarjeta KPI tiene su caso — lo exportado es lo que el objeto ENSENA— y aqui
     * pesa mas, porque la transformacion es justamente lo que el objeto aporta.
     */
    case 'histograma': {
      const vm = toCategorical(result, dimensions, measures, aggregations);
      const settings = instance.presentation?.histogram ?? {};
      const { bins, displayed } = histogramOf(
        vm.points.map((p) => p.values[0]),
        settings,
      );
      const acumulaORelativiza = settings.cumulative === true || settings.relative === true;

      return sameProvenance(
        result,
        [
          columnText('Intervalo'),
          columnNumber('Observaciones'),
          ...(acumulaORelativiza ? [columnNumber(settings.cumulative ? 'Acumulado' : 'Parte')] : []),
        ],
        bins.map((bin, i) => [
          binLabel(bin, String),
          bin.count,
          ...(acumulaORelativiza ? [displayed[i] ?? 0] : []),
        ]),
      );
    }

    case 'diagrama-de-caja': {
      const vm = toCategorical(result, dimensions, measures, aggregations);
      const settings = instance.presentation?.boxplot ?? {};

      return sameProvenance(
        result,
        [
          columnText(fieldKey(dimensions[0] ?? { table: '', field: 'Grupo' })),
          columnNumber('Minimo'),
          columnNumber('Q1'),
          columnNumber('Mediana'),
          columnNumber('Q3'),
          columnNumber('Maximo'),
          columnNumber('Atipicos'),
          columnNumber('Casos'),
        ],
        boxesOf(vm, settings).map((caja) => [
          caja.label,
          caja.low,
          caja.q1,
          caja.median,
          caja.q3,
          caja.high,
          caja.outliers.length,
          caja.count,
        ]),
      );
    }

    case 'mapa-de-calor': {
      // La rejilla, como se ve: una columna por valor de la segunda dimension.
      const grid = gridOf(toCategorical(result, dimensions, measures, aggregations));

      return sameProvenance(
        result,
        [
          columnText(fieldKey(dimensions[0] ?? { table: '', field: 'Fila' })),
          ...grid.columns.map(columnNumber),
        ],
        grid.rows.map((fila) => [fila, ...grid.columns.map((col) => valueAt(grid, fila, col))]),
      );
    }

    case 'diagrama-de-flujo': {
      const graph = flowsOf(toCategorical(result, dimensions, measures, aggregations));

      return sameProvenance(
        result,
        [
          columnText(fieldKey(dimensions[0] ?? { table: '', field: 'Origen' })),
          columnText(fieldKey(dimensions[1] ?? { table: '', field: 'Destino' })),
          columnNumber(measures[0] ?? 'Valor'),
          columnText('Sin dibujar'),
        ],
        [
          ...graph.links.map((f) => [f.source, f.target, f.value, '']),
          // Los apartados VAN en la exportacion: son parte del proceso, y lo unico que les pasa es
          // que el lienzo no sabe trazarlos.
          ...graph.dropped.map((f) => [f.source, f.target, f.value, f.why]),
        ],
      );
    }

    default: {
      // Barras, lineas y cualquier objeto categorico futuro: una fila por categoria.
      const { rows } = aggregateBy(result, dimensions, measures, aggregations);
      const columns = [
        columnText(dimensionsLabel(instance)),
        ...measures.map(columnNumber),
      ];
      return sameProvenance(
        result,
        columns,
        rows.map((f) => [f.labels.join(' / '), ...f.values]),
      );
    }
  }
}

/**
 * Filas de ORIGEN detras de una categoria concreta del objeto — el alcance de subobjeto del
 * complemento de tabla de datos.
 */
export function breakdownOf(
  result: QueryResult,
  selection: Record<string, string>,
): QueryResult {
  const activos = Object.entries(selection)
    .map(([clave, valor]) => ({ index: result.columns.findIndex((c) => c.name === clave), valor }))
    // Una dimension que el dataset ya no expone no puede evaluarse fila a fila. Se ignora, y el
    // desglose queda MAS amplio, nunca mas estrecho: nada se oculta por un cambio de esquema.
    .filter((f) => f.index >= 0);

  if (activos.length === 0) return result;

  return {
    ...result,
    rows: result.rows.filter((row) => activos.every((f) => String(row[f.index]) === f.valor)),
  };
}
