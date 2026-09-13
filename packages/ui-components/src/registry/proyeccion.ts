import type { Agregacion, QueryResult } from '@app/data-contracts';
import type { ObjectInstance } from './types';
import { construirMatriz, filasVisibles, hojas } from './matriz';
import { aFieldRef } from '../presentacion/pozos';
import { aggregateBy, fieldKey, toSlicerOptions } from './viewModel';

/** Proyeccion tabular de un objeto — la forma de tabla de LO QUE EL OBJETO MUESTRA. */

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

/**
 * @param agregaciones Un operador por medida, alineado con `instance.binding.measures`. Viaja
 * desde el servidor con el objeto: asi la tabla en pantalla, el complemento de datos y los cuatro
 * formatos de exportacion resumen con el MISMO operador. Resolverlo aqui por segunda vez seria
 * abrir la puerta a que lo exportado y lo mostrado dieran cifras distintas.
 */
export function proyectarObjeto(
  instance: ObjectInstance,
  result: QueryResult,
  agregaciones: Agregacion[],
): QueryResult {
  const { dimensions, measures } = instance.binding;

  switch (instance.objectId) {
    case 'tarjeta-kpi': {
      // Una tarjeta muestra un numero (o dos, si hay comparacion). Eso es su proyeccion: una
      // fila. Volcar aqui las filas del dataset seria exportar algo que la tarjeta no muestra.
      //
      // Agregar sin ninguna dimension colapsa todo el dataset en una sola fila, resumida con el
      // operador de cada medida — que es exactamente lo que hace la tarjeta al dibujarse.
      const { rows } = aggregateBy(result, [], measures, agregaciones);
      const valores = rows[0]?.values ?? measures.map(() => null);
      const columns = [columnaTexto('Indicador'), ...measures.map(columnaNumero)];
      return mismaProcedencia(result, columns, [
        [instance.title ?? instance.objectId, ...valores],
      ]);
    }

    case 'matriz': {
      /*
       * La misma matriz JERARQUICA que se dibuja, aplanada.
       */
      const nada = new Set<string>();
      const deRanura = (id: string): string[] | undefined => instance.binding.ranuras?.[id];
      const dimsFila = (deRanura('filas') ?? dimensions.slice(0, 1).map(fieldKey)).map(aFieldRef);
      const dimsColumna = (deRanura('columnas') ?? dimensions.slice(1, 2).map(fieldKey)).map(
        aFieldRef,
      );
      const medidas = deRanura('valores') ?? measures;

      const vm = construirMatriz(result, dimsFila, dimsColumna, medidas, agregaciones);
      const columnasHoja = hojas(vm.columnas, nada);

      const columns = [
        columnaTexto(vm.nivelesDeFila.join(' / ') || etiquetaDeDimensiones(instance)),
        ...columnasHoja.flatMap((c) =>
          medidas.map((m) => columnaNumero(medidas.length > 1 ? `${c.etiqueta} · ${m}` : c.etiqueta)),
        ),
        ...medidas.map((m) => columnaNumero(medidas.length > 1 ? `Total · ${m}` : 'Total')),
      ];

      const celdasDe = (ruta: readonly string[]) => [
        ...columnasHoja.flatMap((c) => medidas.map((_, i) => vm.valor(ruta, c.ruta, i))),
        ...medidas.map((_, i) => vm.valor(ruta, [], i)),
      ];

      const rows: unknown[][] = filasVisibles(vm.filas, nada).map((nodo) => [
        // La sangria del nivel viaja como texto: un CSV no tiene jerarquia, y sin ella las filas
        // de subtotal y las de detalle se leerian como si estuvieran al mismo nivel.
        `${'  '.repeat(nodo.nivel)}${nodo.etiqueta}`,
        ...celdasDe(nodo.ruta),
      ]);
      rows.push(['Total', ...celdasDe([])]);
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
      const { rows } = aggregateBy(result, dimensions, measures, agregaciones);
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
      const { rows } = aggregateBy(result, dimensions, measures, agregaciones);
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
