import type { QueryResult } from '@app/data-contracts';
import type { ObjectInstance } from './types';
import { aggregateBy, fieldKey, toMatrix, toSlicerOptions } from './viewModel';

/**
 * Proyeccion tabular de un objeto — la forma de tabla de LO QUE EL OBJETO MUESTRA.
 *
 * Es la unica funcion que traduce "una instancia sobre un dataset" a filas y columnas, y la
 * comparten tres consumidores que antes habrian divergido:
 *
 *   1. El objeto de tabla en pantalla, que sin esto dibujaba TODAS las columnas del dataset en
 *      vez de las que su mapeo declara.
 *   2. El complemento de tabla de datos (el emergente con los datos de origen del objeto).
 *   3. La exportacion a CSV, Excel, PDF e imagen.
 *
 * Antes de existir, la exportacion volcaba el dataset entero bajo el titulo de cada objeto: un
 * modulo con cinco objetos sobre el mismo dataset producia cinco veces la misma tabla, y una
 * tarjeta KPI —que muestra UN numero— exportaba las filas completas. Una sola proyeccion
 * garantiza que lo exportado y lo mostrado no puedan separarse.
 */

const columnaNumero = (name: string) => ({ name, type: 'number' });
const columnaTexto = (name: string) => ({ name, type: 'string' });

/** Etiqueta de la dimension (o dimensiones) que encabeza una proyeccion categorica. */
const etiquetaDeDimensiones = (instance: ObjectInstance): string =>
  instance.binding.dimensions.map(fieldKey).join(' / ') || 'Total';

function mismaProcedencia(result: QueryResult, columns: QueryResult['columns'], rows: unknown[][]): QueryResult {
  // `source` y `generatedAt` se conservan: una proyeccion no cambia de donde vino el dato ni
  // cuando se calculo, y 4.8 los necesita intactos rio abajo.
  return { columns, rows, source: result.source, generatedAt: result.generatedAt };
}

export function proyectarObjeto(instance: ObjectInstance, result: QueryResult): QueryResult {
  const { dimensions, measures } = instance.binding;

  switch (instance.objectId) {
    case 'tarjeta-kpi': {
      // Una tarjeta muestra un numero (o dos, si hay comparacion). Eso es su proyeccion: una
      // fila. Volcar aqui las filas del dataset seria exportar algo que la tarjeta no muestra.
      //
      // Agregar sin ninguna dimension colapsa todo el dataset en una sola fila de sumas, que es
      // exactamente lo que hace la tarjeta al dibujarse.
      const { rows } = aggregateBy(result, [], measures);
      const valores = rows[0]?.values ?? measures.map(() => 0);
      const columns = [columnaTexto('Indicador'), ...measures.map(columnaNumero)];
      return mismaProcedencia(result, columns, [
        [instance.title ?? instance.objectId, ...valores],
      ]);
    }

    case 'matriz': {
      const medida = measures[0] ?? '';
      const vm = toMatrix(result, dimensions, medida);
      const columns = [
        columnaTexto(etiquetaDeDimensiones(instance)),
        ...vm.columnLabels.map(columnaNumero),
        columnaNumero('Total'),
      ];
      const rows: unknown[][] = vm.rowLabels.map((etiqueta, i) => [
        etiqueta,
        ...(vm.cells[i] ?? []),
        vm.rowTotals[i] ?? 0,
      ]);
      rows.push(['Total', ...vm.columnTotals, vm.grandTotal]);
      return mismaProcedencia(result, columns, rows);
    }

    case 'segmentador': {
      const dimension = dimensions[0];
      if (!dimension) return mismaProcedencia(result, [], []);
      const opciones = toSlicerOptions(result, dimension);
      return mismaProcedencia(
        result,
        [columnaTexto(fieldKey(dimension))],
        opciones.map((v) => [v]),
      );
    }

    case 'tabla': {
      // La tabla conserva una columna por dimension, no la etiqueta compuesta: es lo que
      // muestra, y una sola columna "Distrito / Materia" no se puede ordenar ni filtrar.
      const { rows } = aggregateBy(result, dimensions, measures);
      const columns = [
        ...dimensions.map((d) => columnaTexto(fieldKey(d))),
        ...measures.map(columnaNumero),
      ];
      return mismaProcedencia(
        result,
        columns,
        rows.map((f) => [...f.labels, ...f.values]),
      );
    }

    default: {
      // Barras, lineas y cualquier objeto categorico futuro: una fila por categoria.
      const { rows } = aggregateBy(result, dimensions, measures);
      const columns = [
        columnaTexto(etiquetaDeDimensiones(instance)),
        ...measures.map(columnaNumero),
      ];
      return mismaProcedencia(
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
 *
 * Responde a "de que filas sale este numero". Por eso devuelve el dataset SIN proyectar,
 * filtrado por la combinacion seleccionada: lo interesante es justamente la granularidad que el
 * objeto agrego y dejo de mostrar.
 *
 * El dataset del que parte ya viene filtrado por el ambito de quien mira, asi que el desglose no
 * puede revelar ninguna fila que la persona no pudiera ver de todas formas.
 */
export function desgloseDe(
  result: QueryResult,
  seleccion: Record<string, string>,
): QueryResult {
  const activos = Object.entries(seleccion)
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
