import { describe, expect, it } from 'vitest';
import { boxesOf, groupsOf } from './boxplot';
import type { CategoricalViewModel } from '../registry/viewModel';

/** El agrupado de un diagrama de caja. */

const vm = (puntos: [string, number | null][]): CategoricalViewModel => ({
  series: ['Dias'],
  aggregated: false,
  points: puntos.map(([label, valor]) => ({ label, values: [valor] })),
});

/** Como `toCategorical` compone dos dimensiones: «grupo / observacion». */
const DOS_GRUPOS = vm([
  ['Penal / c1', 1],
  ['Penal / c2', 3],
  ['Penal / c3', 5],
  ['Civil / c4', 10],
  ['Civil / c5', 20],
]);

describe('los grupos salen de la PRIMERA dimension', () => {
  it('deshace la etiqueta compuesta por el separador', () => {
    expect(groupsOf(DOS_GRUPOS)).toEqual([
      { label: 'Penal', values: [1, 3, 5] },
      { label: 'Civil', values: [10, 20] },
    ]);
  });

  it('conserva el orden en que aparecen, no el alfabetico', () => {
    // El orden del modelo es el que el editor configuro; reordenar aqui lo pisaria.
    expect(groupsOf(DOS_GRUPOS).map((g) => g.label)).toEqual(['Penal', 'Civil']);
  });

  it('con UNA sola dimension todo cae en una caja', () => {
    /*
     * No es un caso degenerado: es la distribucion del conjunto, que es una lectura legitima.
     */
    const grupos = groupsOf(vm([['c1', 1], ['c2', 2]]));

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.values).toEqual([1, 2]);
  });
});

describe('una caja por grupo', () => {
  it('cada una con su resumen', () => {
    const cajas = boxesOf(DOS_GRUPOS);

    expect(cajas.map((c) => c.label)).toEqual(['Penal', 'Civil']);
    expect(cajas[0]).toMatchObject({ low: 1, median: 3, high: 5, count: 3 });
  });

  it('un grupo sin ninguna observacion numerica NO da una caja plana en cero', () => {
    /*
     * Dibujarla diria que esa materia resuelve todo en cero dias, que es lo contrario de «no se
     * sabe». Se queda fuera, y la tabla del respaldo tampoco la lista.
     */
    const cajas = boxesOf(vm([['Penal / c1', 4], ['Vacio / c2', null]]));

    expect(cajas.map((c) => c.label)).toEqual(['Penal']);
  });

  it('la regla de los bigotes llega hasta la caja', () => {
    const conAtipico = vm([
      ['G / c1', 1],
      ['G / c2', 2],
      ['G / c3', 3],
      ['G / c4', 4],
      ['G / c5', 100],
    ]);

    expect(boxesOf(conAtipico, { whiskers: 'tukey' })[0]?.outliers).toEqual([100]);
    expect(boxesOf(conAtipico, { whiskers: 'extremos' })[0]?.high).toBe(100);
  });

  it('sin puntos no hay cajas', () => {
    expect(boxesOf(vm([]))).toEqual([]);
  });
});
