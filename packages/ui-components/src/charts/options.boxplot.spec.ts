import { describe, expect, it } from 'vitest';
import { optionsOf } from './options';
import type { CategoricalViewModel } from '../registry/viewModel';

/** El dibujo de un diagrama de caja — seccion 2.7. */

const palette = {
  series: ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8'],
  content: '#t',
  mutedText: '#ta',
  line: '#l',
  superficie: '#s',
  superficieElevada: '#se',
};

/** Dos materias, con un expediente que se sale en la primera. */
const vm: CategoricalViewModel = {
  series: ['DiasResolucion'],
  aggregated: false,
  points: [
    ...[1, 2, 3, 4, 500].map((v, i) => ({ label: `Penal / c${i}`, values: [v] })),
    ...[10, 11, 12, 13].map((v, i) => ({ label: `Civil / c${i}`, values: [v] })),
  ],
};

/* eslint-disable @typescript-eslint/no-explicit-any -- se comprueba la forma que consume ECharts */
const caja = (extra: Record<string, unknown> = {}) =>
  optionsOf('diagrama-de-caja', {
    vm,
    palette,
    titulo: 'Dias por materia',
    formatear: (n: number) => `${n} d`,
    layerLabels: { outliers: 'Atipicos', mean: 'Media' },
    ...extra,
  }) as any;

describe('el diagrama de caja dibuja una caja por grupo', () => {
  it('cinco numeros por caja, en el orden que ECharts espera', () => {
    const o = caja();

    expect(o.series[0].type).toBe('boxplot');
    expect(o.xAxis.data).toEqual(['Penal', 'Civil']);
    // [minimo, Q1, mediana, Q3, maximo] — cualquier otro orden dibuja una caja al reves.
    const penal = o.series[0].data[0];
    expect(penal).toHaveLength(5);
    expect([...penal].sort((a: number, b: number) => a - b)).toEqual(penal);
  });

  it('los atipicos van en su propia capa, con su nombre y su forma', () => {
    const o = caja();
    const atipicos = o.series.find((s: { name: string }) => s.name === 'Atipicos');

    // Distinguirlos solo por el color no vale (4.9): son puntos sueltos, otra forma.
    expect(atipicos.type).toBe('scatter');
    // El indice del grupo y el valor: el expediente de 500 dias, en la primera materia.
    expect(atipicos.data).toEqual([[0, 500]]);
  });

  it('con los bigotes en los extremos no queda ningun atipico que dibujar', () => {
    const o = caja({ boxplot: { whiskers: 'extremos' } });

    expect(o.series.some((s: { name: string }) => s.name === 'Atipicos')).toBe(false);
    // Y el bigote llega al expediente que antes se salia.
    expect(o.series[0].data[0][4]).toBe(500);
  });

  it('los atipicos se pueden apagar sin cambiar de regla', () => {
    expect(
      caja({ boxplot: { outliers: false } }).series.some(
        (s: { name: string }) => s.name === 'Atipicos',
      ),
    ).toBe(false);
  });

  it('la media es una capa aparte, en rombo para no confundirla con un atipico', () => {
    const o = caja({ boxplot: { mean: true } });
    const media = o.series.find((s: { name: string }) => s.name === 'Media');

    expect(media.symbol).toBe('diamond');
    expect(media.data).toHaveLength(2);
  });

  it('sin pedirla, la media no se dibuja', () => {
    expect(caja().series.some((s: { name: string }) => s.name === 'Media')).toBe(false);
  });
});

describe('el eje de valores SI mide la medida, al reves que en el histograma', () => {
  it('la referencia se ancla donde se anclan siempre', () => {
    /*
     * Un plazo de 180 dias cruza todas las cajas a su altura. Es la diferencia con el histograma,
     * donde el eje de valores cuenta casos y la referencia hay que traducirla al de intervalos.
     */
    const linea = caja({ references: [{ valor: 180, etiqueta: 'Plazo' }] }).series[0].markLine
      .data[0];

    expect(linea).toHaveProperty('yAxis', 180);
    expect(linea).not.toHaveProperty('xAxis');
  });

  it('el titulo del eje lo pone quien configura', () => {
    expect(caja({ axes: { yTitle: 'Dias' } }).yAxis.name).toBe('Dias');
  });
});

describe('lo que el diagrama de caja NO hereda', () => {
  const sin = JSON.stringify(caja());

  for (const [clave, valor] of [
    ['apilado', 'porcentaje'],
    ['tooltip', { total: true, sortValue: true }],
  ] as [string, unknown][]) {
    it(`${clave} no cambia nada`, () => {
      expect(JSON.stringify(caja({ [clave]: valor }))).toBe(sin);
    });
  }
});

describe('los rotulos de las capas llegan de fuera', () => {
  it('el paquete no escribe texto visible: lo recibe ya traducido', () => {
    const o = caja({ layerLabels: { outliers: 'Outliers', mean: 'Mean' }, boxplot: { mean: true } });

    expect(o.series.map((s: { name: string }) => s.name)).toEqual([
      'DiasResolucion',
      'Outliers',
      'Mean',
    ]);
  });
});
