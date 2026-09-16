import { LABEL_SEPARATOR, type CategoricalViewModel } from '../registry/viewModel';

/**
 * Mapa de calor — dos dimensiones cruzadas, con la intensidad diciendo cuanto.
 *
 * La rejilla se arma aqui, una vez, y de ella leen el dibujo Y el respaldo en DOM. El respaldo
 * ademas no es un extra: un mapa de calor comunica por el COLOR, y el principio 4 no admite el
 * color como unico portador, asi que la tabla con las cifras es la otra mitad del objeto.
 */

export interface HeatCell {
  row: string;
  column: string;
  value: number | null;
}

export interface HeatGrid {
  /** En el orden en que aparecen en el modelo, que es el que el editor configuro. */
  rows: string[];
  columns: string[];
  cells: HeatCell[];
  /** Los extremos de lo que hay, para repartir la escala de color. `null` sin ninguna cifra. */
  min: number | null;
  max: number | null;
}

/**
 * Arma la rejilla a partir de un modelo de DOS dimensiones.
 *
 * `toCategorical` compone «Penal / Q1», asi que la fila es lo que va antes del separador y la
 * columna lo que va detras. Sin separador no hay cruce que dibujar: todo cae en una sola columna,
 * lo que deja el objeto como una tira de una fila en vez de reventar.
 */
export function gridOf(vm: CategoricalViewModel): HeatGrid {
  const rows: string[] = [];
  const columns: string[] = [];
  const cells: HeatCell[] = [];
  let min: number | null = null;
  let max: number | null = null;

  for (const punto of vm.points) {
    const corte = punto.label.indexOf(LABEL_SEPARATOR);
    const row = corte < 0 ? punto.label : punto.label.slice(0, corte);
    const column = corte < 0 ? '' : punto.label.slice(corte + LABEL_SEPARATOR.length);

    if (!rows.includes(row)) rows.push(row);
    if (!columns.includes(column)) columns.push(column);

    const value = punto.values[0] ?? null;
    cells.push({ row, column, value });

    if (value !== null) {
      min = min === null ? value : Math.min(min, value);
      max = max === null ? value : Math.max(max, value);
    }
  }

  return { rows, columns, cells, min, max };
}

/** Lo que hay en un cruce. `null` tambien cuando el cruce no existe: no es un cero. */
export function valueAt(grid: HeatGrid, row: string, column: string): number | null {
  return grid.cells.find((c) => c.row === row && c.column === column)?.value ?? null;
}
