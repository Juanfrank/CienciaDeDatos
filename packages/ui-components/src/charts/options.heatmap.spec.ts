import { describe, expect, it } from 'vitest';
import { optionsOf } from './options';
import type { CategoricalViewModel } from '../registry/viewModel';

/** El dibujo de un mapa de calor — seccion 2.7, y el principio 4. */

const palette = {
  series: ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8'],
  content: '#t',
  mutedText: '#ta',
  line: '#l',
  superficie: '#s',
  superficieElevada: '#se',
};

const vm: CategoricalViewModel = {
  series: ['CasosPendientes'],
  aggregated: false,
  points: [
    { label: 'Penal / Q1', values: [10] },
    { label: 'Penal / Q2', values: [20] },
    { label: 'Civil / Q1', values: [30] },
    { label: 'Civil / Q2', values: [null] },
  ],
};

/* eslint-disable @typescript-eslint/no-explicit-any -- se comprueba la forma que consume ECharts */
const calor = (extra: Record<string, unknown> = {}) =>
  optionsOf('mapa-de-calor', {
    vm,
    palette,
    titulo: 'Pendientes',
    formatear: (n: number) => `${n} casos`,
    ...extra,
  }) as any;

describe('el color NO es el unico portador (principio 4)', () => {
  it('la cifra va dentro de la celda por omision', () => {
    const o = calor();

    expect(o.series[0].label.show).toBe(true);
    expect(o.series[0].label.formatter({ data: [0, 0, 10] })).toBe('10 casos');
  });

  it('una celda sin dato no escribe un cero', () => {
    // Un cero diria «aqui no hay pendientes» donde lo que hay es un cruce que no existe.
    expect(calor().series[0].label.formatter({ data: [1, 1, null] })).toBe('');
  });

  it('se puede apagar, y entonces la lectura vive en el respaldo', () => {
    expect(calor({ heatmap: { showValue: false } }).series[0].label.show).toBe(false);
  });
});

describe('los dos ejes son de categorias', () => {
  it('las columnas van en el eje X y las filas en el Y', () => {
    const o = calor();

    expect(o.xAxis.data).toEqual(['Q1', 'Q2']);
    expect(o.yAxis.data).toEqual(['Penal', 'Civil']);
    expect(o.yAxis.type).toBe('category');
  });

  it('cada celda lleva su par de indices y su valor', () => {
    expect(calor().series[0].data).toEqual([
      [0, 0, 10],
      [1, 0, 20],
      [0, 1, 30],
      [1, 1, null],
    ]);
  });
});

describe('el reparto del color', () => {
  it('secuencial va de lo que hay menos a lo que hay mas', () => {
    const o = calor();

    expect(o.visualMap.min).toBe(10);
    expect(o.visualMap.max).toBe(30);
  });

  it('divergente se hace SIMETRICO alrededor del punto medio', () => {
    /*
     * Sin simetria, el mismo alejamiento a un lado y al otro se pintaria con intensidades
     * distintas, y el degradado diria que una desviacion es mayor que la otra siendo iguales.
     *
     * El punto medio se elige DESCENTRADO respecto a los datos —van de 10 a 30 y el medio es 15—
     * a proposito: con uno que ya cayera en el centro, la simetria saldria por casualidad y la
     * comprobacion pasaria igual sin estar hecha.
     */
    const o = calor({ heatmap: { scale: 'divergente', mid: 15 } });

    expect(o.visualMap.max - 15).toBe(15 - o.visualMap.min);
    expect(o.visualMap.min).toBe(0);
    expect(o.visualMap.max).toBe(30);
  });

  it('el degradado sale del hueco de la paleta elegido, no de uno fijo', () => {
    // Si no, el control de color estaria puesto en el panel y no responderia.
    expect(calor({ seriesColors: [4] }).visualMap.inRange.color).toContain('#5');
  });

  it('en divergente la superficie queda en medio', () => {
    const colores = calor({ heatmap: { scale: 'divergente' }, seriesColors: [0] }).visualMap.inRange
      .color;

    expect(colores).toHaveLength(3);
    expect(colores[1]).toBe('#s');
  });
});

describe('lo que el mapa de calor NO hereda', () => {
  const sin = JSON.stringify(calor());

  for (const [clave, valor] of [
    ['apilado', 'porcentaje'],
    ['tooltip', { total: true }],
    // Una raya en «180 dias» no cruza ningun eje que mida dias: los dos son de categorias.
    ['references', [{ valor: 15, etiqueta: 'Meta' }]],
    ['legend', 'derecha'],
  ] as [string, unknown][]) {
    it(`${clave} no cambia nada`, () => {
      expect(JSON.stringify(calor({ [clave]: valor }))).toBe(sin);
    });
  }
});
