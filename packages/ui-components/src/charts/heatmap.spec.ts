import { describe, expect, it } from 'vitest';
import { gridOf, valueAt } from './heatmap';
import type { CategoricalViewModel } from '../registry/viewModel';

/** La rejilla de un mapa de calor. */

const vm = (puntos: [string, number | null][]): CategoricalViewModel => ({
  series: ['Pendientes'],
  aggregated: false,
  points: puntos.map(([label, valor]) => ({ label, values: [valor] })),
});

const CRUCE = vm([
  ['Penal / Q1', 10],
  ['Penal / Q2', 20],
  ['Civil / Q1', 30],
  ['Civil / Q2', 40],
]);

describe('la rejilla sale de dos dimensiones cruzadas', () => {
  it('la primera son las filas y la segunda las columnas', () => {
    const grid = gridOf(CRUCE);

    expect(grid.rows).toEqual(['Penal', 'Civil']);
    expect(grid.columns).toEqual(['Q1', 'Q2']);
  });

  it('conserva el orden del modelo, que es el que el editor configuro', () => {
    expect(gridOf(vm([['B / Z', 1], ['A / Y', 2]])).rows).toEqual(['B', 'A']);
  });

  it('cada cruce guarda su valor', () => {
    const grid = gridOf(CRUCE);

    expect(valueAt(grid, 'Civil', 'Q2')).toBe(40);
    expect(grid.cells).toHaveLength(4);
  });

  it('los extremos reparten la escala de color', () => {
    const grid = gridOf(CRUCE);

    expect(grid.min).toBe(10);
    expect(grid.max).toBe(40);
  });

  it('un cruce que no existe es null, no un cero', () => {
    /*
     * Un cero pintaria la celda del color mas frio y diria «aqui no hay casos pendientes», cuando
     * lo que pasa es que esa combinacion no aparece en el dataset.
     */
    const grid = gridOf(vm([['Penal / Q1', 5], ['Civil / Q2', 7]]));

    expect(valueAt(grid, 'Penal', 'Q2')).toBeNull();
    expect(grid.min).toBe(5);
  });

  it('un hueco tampoco arrastra los extremos', () => {
    const grid = gridOf(vm([['A / Q1', null], ['A / Q2', 9]]));

    expect(grid.min).toBe(9);
    expect(grid.max).toBe(9);
  });

  it('sin ninguna cifra no hay escala que repartir', () => {
    expect(gridOf(vm([['A / Q1', null]]))).toMatchObject({ min: null, max: null });
  });

  it('con UNA sola dimension queda una tira de una columna, no un error', () => {
    const grid = gridOf(vm([['Penal', 1], ['Civil', 2]]));

    expect(grid.rows).toEqual(['Penal', 'Civil']);
    expect(grid.columns).toEqual(['']);
  });
});
