import { describe, expect, it } from 'vitest';
import { optionsOf } from './options';
import type { CategoricalViewModel } from '../registry/viewModel';

/** El dibujo de un histograma — seccion 2.7. */

const palette = {
  series: ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8'],
  content: '#t',
  mutedText: '#ta',
  line: '#l',
  superficie: '#s',
  superficieElevada: '#se',
};

/** Cien observaciones de una medida, una por fila: lo que un dataset atomico entrega. */
const observaciones: CategoricalViewModel = {
  series: ['DiasResolucion'],
  aggregated: false,
  points: Array.from({ length: 100 }, (_, i) => ({ label: `caso-${i}`, values: [i] })),
};

/* eslint-disable @typescript-eslint/no-explicit-any -- se comprueba la forma que consume ECharts */
const histograma = (extra: Record<string, unknown> = {}) =>
  optionsOf('histograma', {
    vm: observaciones,
    palette,
    titulo: 'Dias hasta la resolucion',
    // El formateador de la MEDIDA: los dias llevan su unidad.
    formatear: (n: number) => `${n} d`,
    ...extra,
  }) as any;

describe('el histograma dibuja intervalos, no observaciones', () => {
  it('una barra por intervalo, y no una por fila del dataset', () => {
    const o = histograma({ histogram: { bins: 5 } });

    expect(o.series[0].type).toBe('bar');
    expect(o.xAxis.data).toHaveLength(5);
    expect(o.series[0].data).toHaveLength(5);
  });

  it('el eje de categorias nombra los intervalos con el formato de la medida', () => {
    const o = histograma({ histogram: { bins: 2 } });

    // Sin el formato, el eje diria «0 – 49.5» donde la medida se lee «0 d – 49,5 d».
    expect(o.xAxis.data[0]).toContain(' d');
    expect(o.xAxis.data[0]).toContain('–');
  });

  it('el alto de la barra es un RECUENTO, y no se formatea como la medida', () => {
    /*
     * Es la trampa de este objeto: el formateador que llega es el de los dias, y la barra mide
     * casos. Aplicandolo, cincuenta CASOS se dibujarian como «50 d».
     */
    const o = histograma({ histogram: { bins: 2 }, datumLabels: { mostrar: true } });
    const etiqueta = o.series[0].label.formatter({ value: 50, dataIndex: 0 });

    expect(etiqueta).toBe('50');
    expect(etiqueta).not.toContain('d');
  });

  it('en relativo la etiqueta lleva el signo de porcentaje', () => {
    const o = histograma({
      histogram: { bins: 2, relative: true },
      datumLabels: { mostrar: true },
    });

    expect(o.series[0].label.formatter({ value: 50, dataIndex: 0 })).toBe('50.0 %');
  });
});

describe('la linea de referencia habla de la medida, no del recuento', () => {
  const conPlazo = () =>
    histograma({
      histogram: { bins: 4 },
      references: [{ valor: 50, etiqueta: 'Plazo', color: 'error' }],
    });

  it('se ancla al eje de los intervalos y NO al de las observaciones', () => {
    /*
     * `referencesOf` las cuelga del eje de valores. Aqui ese eje cuenta casos, asi que un plazo
     * de «50 dias» apareceria a la altura de 50 CASOS: una raya que parece medir algo y mide otra
     * cosa. Es peor que no tenerla, porque nadie sospecha de una raya rotulada.
     */
    const linea = conPlazo().series[0].markLine.data[0];

    expect(linea).toHaveProperty('xAxis');
    expect(linea).not.toHaveProperty('yAxis');
  });

  it('cae dentro del intervalo que contiene el umbral', () => {
    // Con cien observaciones de 0 a 99 en cuatro intervalos, el 50 cae en el tercero.
    const posicion = conPlazo().series[0].markLine.data[0].xAxis;

    expect(posicion).toBeGreaterThan(1.5);
    expect(posicion).toBeLessThan(2.5);
  });

  it('sin referencias no se inventa una marca', () => {
    expect(histograma().series[0].markLine).toBeUndefined();
  });
});

describe('lo que el histograma NO hereda de las barras', () => {
  /*
   * Cada una se ignora por un motivo distinto y todos estan escritos en `histogramOptions`. Lo
   * que esta prueba ata es que se sigan ignorando: cualquiera de ellas llegando al dibujo pone un
   * control en el panel que estropea el grafico o lo colorea por un numero que no es el suyo.
   */
  const sin = JSON.stringify(histograma({ histogram: { bins: 4 } }));

  const IGNORADAS: [string, unknown][] = [
    ['apilado', 'porcentaje'],
    ['legend', 'derecha'],
    ['tooltip', { total: true, sortValue: true }],
    [
      'conditional',
      { rules: [{ medida: 'DiasResolucion', comparator: 'mayor', valor: 5, color: 'peligro' }] },
    ],
  ];

  for (const [clave, valor] of IGNORADAS) {
    it(`${clave} no cambia nada`, () => {
      expect(JSON.stringify(histograma({ histogram: { bins: 4 }, [clave]: valor }))).toBe(sin);
    });
  }
});

describe('lo que el histograma SI honra', () => {
  it('los titulos de los ejes, que es donde se dice que mide cada uno', () => {
    const o = histograma({ axes: { xTitle: 'Dias', yTitle: 'Casos' } });

    expect(o.xAxis.name).toBe('Dias');
    expect(o.yAxis.name).toBe('Casos');
  });

  it('el color de la serie, elegido del hueco de la paleta que se pida', () => {
    expect(histograma({ seriesColors: [3] }).color[0]).toBe('#4');
  });

  it('el acumulado no baja nunca', () => {
    const datos: number[] = histograma({ histogram: { bins: 6, cumulative: true } }).series[0].data;

    expect(datos).toEqual([...datos].sort((a, b) => a - b));
  });
});
