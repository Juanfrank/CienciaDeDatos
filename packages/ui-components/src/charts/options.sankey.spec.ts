import { describe, expect, it } from 'vitest';
import { optionsOf } from './options';
import type { CategoricalViewModel } from '../registry/viewModel';

/** El dibujo de un diagrama de flujo — seccion 2.7. */

const palette = {
  series: ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8'],
  content: '#t',
  mutedText: '#ta',
  line: '#l',
  superficie: '#s',
  superficieElevada: '#se',
};

const vm: CategoricalViewModel = {
  series: ['CasosResueltos'],
  aggregated: false,
  points: [
    { label: 'Ingreso / Audiencia', values: [100] },
    { label: 'Audiencia / Sentencia', values: [70] },
    { label: 'Sentencia / Ingreso', values: [5] },
  ],
};

/* eslint-disable @typescript-eslint/no-explicit-any -- se comprueba la forma que consume ECharts */
const flujo = (extra: Record<string, unknown> = {}) =>
  optionsOf('diagrama-de-flujo', {
    vm,
    palette,
    titulo: 'Flujo',
    formatear: (n: number) => `${n} casos`,
    ...extra,
  }) as any;

describe('el diagrama de flujo dibuja nodos y enlaces', () => {
  it('un nodo por etapa y un enlace por paso', () => {
    const o = flujo();

    expect(o.series[0].type).toBe('sankey');
    expect(o.series[0].data.map((n: { name: string }) => n.name)).toEqual([
      'Ingreso',
      'Audiencia',
      'Sentencia',
    ]);
    expect(o.series[0].links).toHaveLength(2);
  });

  it('el enlace que cerraria el ciclo NO llega al lienzo', () => {
    // Con el, el trazado de ECharts se queda dando vueltas. El respaldo si lo lista.
    expect(
      flujo().series[0].links.some((l: { source: string }) => l.source === 'Sentencia'),
    ).toBe(false);
  });

  it('cada nodo lleva su color de la paleta, y no todos el mismo', () => {
    const colores = flujo().series[0].data.map((n: { itemStyle: { color: string } }) =>
      n.itemStyle.color,
    );

    expect(new Set(colores).size).toBe(3);
  });

  it('la paleta se puede remapear desde el panel', () => {
    expect(flujo({ seriesColors: [4] }).series[0].data[0].itemStyle.color).toBe('#5');
  });
});

describe('lo que el panel configura', () => {
  it('la orientacion', () => {
    expect(flujo().series[0].orient).toBe('horizontal');
    expect(flujo({ sankey: { orient: 'vertical' } }).series[0].orient).toBe('vertical');
  });

  it('donde se alinean las etapas, traducido a lo que ECharts entiende', () => {
    expect(flujo().series[0].nodeAlign).toBe('justify');
    expect(flujo({ sankey: { nodeAlign: 'izquierda' } }).series[0].nodeAlign).toBe('left');
    expect(flujo({ sankey: { nodeAlign: 'derecha' } }).series[0].nodeAlign).toBe('right');
  });

  it('la cifra junto al nombre, con el formato de la medida', () => {
    const sin = flujo().series[0].label.formatter({ name: 'Ingreso', value: 100 });
    const con = flujo({ sankey: { showValue: true } }).series[0].label.formatter({
      name: 'Ingreso',
      value: 100,
    });

    expect(sin).toBe('Ingreso');
    expect(con).toBe('Ingreso: 100 casos');
  });
});

describe('lo que el diagrama de flujo NO hereda', () => {
  const sin = JSON.stringify(flujo());

  for (const [clave, valor] of [
    ['axes', { xTitle: 'X', yTitle: 'Y', gridlines: false }],
    // No hay ejes donde anclar una raya: el grosor del enlace ya ES la cifra.
    ['references', [{ valor: 50, etiqueta: 'Meta' }]],
    ['apilado', 'porcentaje'],
    ['datumLabels', { mostrar: true }],
  ] as [string, unknown][]) {
    it(`${clave} no cambia nada`, () => {
      expect(JSON.stringify(flujo({ [clave]: valor }))).toBe(sin);
    });
  }
});
