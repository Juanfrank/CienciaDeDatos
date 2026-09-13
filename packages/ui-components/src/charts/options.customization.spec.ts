import { describe, expect, it } from 'vitest';
import { optionsOf, type ChartKind } from './options';
import { sortCategories } from './sort';
import type { CategoricalViewModel } from '../registry/viewModel';

const palette = {
  series: ['#1', '#2'],
  content: '#t',
  textoAtenuado: '#ta',
  line: '#l',
  superficie: '#s',
  superficieElevada: '#se',
};

const vm = (series: string[], puntos: [string, ...(number | null)[]][]): CategoricalViewModel => ({
  series,
  points: puntos.map(([label, ...values]) => ({ label, values })),
  aggregated: false,
});

/*
 * Se comprueba la FORMA del objeto de opciones, que es lo que ECharts consume.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ver el comentario de arriba */
const opciones = (extra: Record<string, unknown> = {}, v = vm(['A'], [['x', 1]])) =>
  optionsOf('barras', { vm: v, palette, titulo: 'T', ...extra }) as any;

describe('leyenda', () => {
  it('auto la ensena solo con varias series', () => {
    // Con una sola serie no distingue nada y se come el alto del grafico.
    expect(opciones().legend.show).toBe(false);
    expect(opciones({}, vm(['A', 'B'], [['x', 1, 2]])).legend.show).not.toBe(false);
  });

  it('cada posicion la ancla a su lado Y le reserva margen', () => {
    // `containLabel` de ECharts cuenta los rotulos del eje pero NO la leyenda: sin reservar, se
    // dibuja encima de los nombres de las categorias y quedan ilegibles los dos.
    const derecha = opciones({ leyenda: 'derecha' });
    expect(derecha.legend.right).toBe(0);
    expect(derecha.legend.orient).toBe('vertical');
    expect(derecha.grid.right).toBeGreaterThan(opciones().grid.right);

    const arriba = opciones({ leyenda: 'arriba' });
    expect(arriba.legend.top).toBe(0);
    expect(arriba.grid.top).toBeGreaterThan(opciones().grid.top);
  });

  it('oculta la quita aunque haya varias series', () => {
    expect(opciones({ leyenda: 'oculta' }, vm(['A', 'B'], [['x', 1, 2]])).legend.show).toBe(false);
  });
});

describe('etiquetas de dato', () => {
  it('apagadas por defecto', () => {
    expect(opciones().series[0].label.show).toBe(false);
  });

  it('usan el formateador de SU medida, no el numero crudo', () => {
    const o = opciones(
      {
        etiquetasDeDato: true,
        formatear: (v: number, s: number) => `${s}:${v.toFixed(1)}`,
      },
      vm(['A', 'B'], [['x', 1, 2]]),
    );
    // Sin esto, la cifra sobre la barra diria «2216» mientras la tabla adjunta dice «2,216 casos»:
    // el mismo numero, dos lecturas, en la misma tarjeta.
    expect(o.series[0].label.formatter({ value: 1 })).toBe('0:1.0');
    expect(o.series[1].label.formatter({ value: 2 })).toBe('1:2.0');
  });
});

describe('ejes', () => {
  it('empiezan en cero salvo que alguien lo decida', () => {
    // `scale: true` de ECharts ajusta el minimo a los datos, y con eso una diferencia del 2 %
    // parece el triple. Que sea explicito es la diferencia entre un grafico y uno enganoso.
    expect(opciones().yAxis.scale).toBe(false);
    expect(opciones({ ejes: { desdeCero: false } }).yAxis.scale).toBe(true);
  });

  it('se pueden ocultar y titular', () => {
    const o = opciones({ ejes: { mostrarY: false, tituloX: 'Distrito', cuadricula: false } });
    expect(o.yAxis.show).toBe(false);
    expect(o.xAxis.name).toBe('Distrito');
    expect(o.yAxis.splitLine.show).toBe(false);
  });

  it('sin titulo escrito, el eje no lleva ninguno', () => {
    // El nombre del campo no sirve: `DimTribunal.Distrito` se recortaba a una letra al borde.
    expect(opciones().xAxis.name).toBeUndefined();
  });
});

describe('orden de las categorias', () => {
  const datos = vm(['A'], [['b', 2], ['a', 3], ['c', 1]]);

  it('sin criterio, respeta el orden del dataset', () => {
    expect(sortCategories(datos, undefined).points.map((p) => p.label)).toEqual(['b', 'a', 'c']);
  });

  it('por categoria y por valor, en las dos direcciones', () => {
    const labels = (o: Parameters<typeof sortCategories>[1]) =>
      sortCategories(datos, o).points.map((p) => p.label);
    expect(labels({ por: 'categoria' })).toEqual(['a', 'b', 'c']);
    expect(labels({ por: 'categoria', direccion: 'desc' })).toEqual(['c', 'b', 'a']);
    expect(labels({ por: 'valor' })).toEqual(['c', 'b', 'a']);
    expect(labels({ por: 'valor', direccion: 'desc' })).toEqual(['a', 'b', 'c']);
  });

  it('los huecos van al final, se ordene como se ordene', () => {
    const withHole = vm(['A'], [['a', null], ['b', 5], ['c', 0]]);
    // Tratar `null` como cero lo mezclaria con las categorias que valen cero de verdad, y
    // «no se puede calcular» y «vale cero» son cosas distintas.
    expect(sortCategories(withHole, { por: 'valor' }).points.map((p) => p.label)).toEqual(['c', 'b', 'a']);
    expect(sortCategories(withHole, { por: 'valor', direccion: 'desc' }).points.map((p) => p.label)).toEqual(['b', 'c', 'a']);
  });

  it('no muta el modelo recibido', () => {
    // El mismo `vm` alimenta al grafico y a su respaldo en HTML: mutarlo aqui reordenaria uno
    // de los dos a mitad de render.
    sortCategories(datos, { por: 'valor' });
    expect(datos.points.map((p) => p.label)).toEqual(['b', 'a', 'c']);
  });
});

describe('el margen reserva sitio para lo que vive fuera del area de dibujo', () => {
  it('un titulo de eje Y ensancha el margen izquierdo', () => {
    // Sin reservarlo, `nameGap` dibujaba el titulo 44 px a la izquierda del eje: fuera de la
    // tarjeta. Un titulo que se configura y no aparece es peor que no ofrecerlo.
    const sin = opciones();
    const con = opciones({ ejes: { tituloY: 'Casos' } });
    expect(con.grid.left).toBeGreaterThan(sin.grid.left);
  });

  it('la leyenda lateral y el titulo del eje SUMAN margen, no compiten por el', () => {
    const onlyLegend = opciones({ leyenda: 'izquierda' });
    const ambos = opciones({ leyenda: 'izquierda', ejes: { tituloY: 'Casos' } });
    expect(ambos.grid.left).toBeGreaterThan(onlyLegend.grid.left);
  });
});

describe('lineas de referencia', () => {
  const conRef = (extra: Record<string, unknown> = {}, v = vm(['A'], [['x', 1]])) =>
    opciones({ referencias: [{ valor: 900, etiqueta: 'Meta' }], ...extra }, v);

  it('cuelgan de la PRIMERA serie, no de una serie propia', () => {
    /*
     * Una serie propia apareceria en la leyenda y en el tooltip como si fuera un dato mas, y una
     * meta no es un dato medido. Y en una serie cualquiera desapareceria al ocultar esa medida
     * desde la leyenda.
     */
    const o = conRef({}, vm(['A', 'B'], [['x', 1, 2]]));
    expect(o.series[0].markLine.data).toHaveLength(1);
    expect(o.series[1].markLine).toBeUndefined();
  });

  it('se anclan al eje de VALORES, que cambia con la orientacion', () => {
    // En unas barras horizontales el eje de valores es el X: anclarlas siempre al Y dibujaria la
    // meta atravesada.
    expect(conRef().series[0].markLine.data[0].yAxis).toBe(900);
    const horizontal = optionsOf('barras-horizontales', {
      vm: vm(['A'], [['x', 1]]),
      palette,
      titulo: 'T',
      referencias: [{ valor: 900 }],
    }) as any;
    expect(horizontal.series[0].markLine.data[0].xAxis).toBe(900);
  });

  it('no responden al raton: una meta no se consulta, se mira', () => {
    expect(conRef().series[0].markLine.silent).toBe(true);
    expect(conRef().series[0].markLine.symbol).toBe('none');
  });

  it('sin rotulo, la raya se dibuja pero no escribe nada', () => {
    const o = opciones({ referencias: [{ valor: 900 }] });
    expect(o.series[0].markLine.data[0].label.show).toBe(false);
  });

  it('se recortan al maximo: mas de tres dejan de ser referencias', () => {
    const o = opciones({
      referencias: [{ valor: 1 }, { valor: 2 }, { valor: 3 }, { valor: 4 }],
    });
    expect(o.series[0].markLine.data).toHaveLength(3);
  });

  it('sin referencias no se anade nada a la serie', () => {
    expect(opciones().series[0].markLine).toBeUndefined();
  });

  it('llegan a TODOS los tipos que las declaran, no solo a las columnas', () => {
    /*
     * Esta prueba existe porque faltaron en las lineas.
     */
    const withAxes: ChartKind[] = [
      'barras',
      'barras-horizontales',
      'lineas',
      'area',
      'combinado',
      'cascada',
      'dispersion',
    ];
    for (const tipo of withAxes) {
      const o = optionsOf(tipo, {
        vm: vm(['A', 'B'], [['x', 1, 2]]),
        palette,
        titulo: 'T',
        columnSeries: 1,
        referencias: [{ valor: 5, etiqueta: 'Meta' }],
      }) as any;
      const withMark = o.series.filter((s: { markLine?: unknown }) => s.markLine !== undefined);
      expect(withMark, tipo).toHaveLength(1);
    }
  });
});

describe('limites del eje y color por serie', () => {
  it('los limites escritos a mano mandan sobre el automatico', () => {
    const o = opciones({ ejes: { minimoY: 100, maximoY: 500 } });
    expect(o.yAxis.min).toBe(100);
    expect(o.yAxis.max).toBe(500);
  });

  it('pero el 100 % los impone: el eje va de 0 a 100 porque eso es lo que mide', () => {
    // Dejar cambiarlos produciria un «100 %» que no llega al borde.
    const o = opciones({ apilado: 'porcentaje', ejes: { minimoY: 40, maximoY: 60 } });
    expect(o.yAxis.min).toBe(0);
    expect(o.yAxis.max).toBe(100);
  });

  it('el color por serie PERMUTA la paleta, para que llegue tambien a la leyenda', () => {
    /*
     * Escribiendo `itemStyle.color` en cada serie, la barra cambiaba de color y la muestra de la
     * leyenda se quedaba con el de antes.
     */
    const o = opciones({ coloresDeSerie: [1, 0] }, vm(['A', 'B'], [['x', 1, 2]]));
    expect(o.color).toEqual(['#2', '#1']);
  });

  it('una serie sin asignacion se queda con el color que le tocaba por orden', () => {
    const o = opciones({ coloresDeSerie: [1] }, vm(['A', 'B'], [['x', 1, 2]]));
    expect(o.color).toEqual(['#2', '#2']);
  });
});

describe('etiquetas de dato: las tres opciones, no dos', () => {
  const withLabels = (
    valor: unknown,
    v = vm(['A'], [['x', 10], ['y', 50], ['z', 30]]),
  ) => opciones({ etiquetasDeDato: valor, formatear: (n: number) => `${n} c` }, v);

  it('la forma anterior —un booleano— se sigue leyendo', () => {
    // Un modulo publicado antes de esto lleva `etiquetasDeDato: true` y tiene que dibujarse igual.
    expect(withLabels(true).series[0].label.show).toBe(true);
    expect(withLabels(false).series[0].label.show).toBe(false);
  });

  it('solo los extremos rotula el maximo y el minimo, y calla el resto', () => {
    const etiqueta = withLabels({ soloExtremos: true }).series[0].label.formatter;
    expect(etiqueta({ value: 50, dataIndex: 1 })).toBe('50 c');
    expect(etiqueta({ value: 10, dataIndex: 0 })).toBe('10 c');
    expect(etiqueta({ value: 30, dataIndex: 2 })).toBe('');
  });

  it('un nulo no compite por ser el minimo: no es un numero', () => {
    const o = withLabels({ soloExtremos: true }, vm(['A'], [['x', 10], ['y', null], ['z', 30]]));
    const etiqueta = o.series[0].label.formatter;
    expect(etiqueta({ value: 10, dataIndex: 0 })).toBe('10 c');
    expect(etiqueta({ value: 30, dataIndex: 2 })).toBe('30 c');
  });

  it('la posicion elegida manda sobre la que el tipo de grafico propone', () => {
    expect(withLabels({ cellPosition: 'dentro' }).series[0].label.position).toBe('inside');
    // `auto` deja la del tipo: encima en columnas.
    expect(withLabels({ cellPosition: 'auto' }).series[0].label.position).toBe('top');
  });
});

describe('tooltip', () => {
  const dos = vm(['A', 'B'], [['x', 10, 30]]);
  const params = [
    { name: 'x', seriesName: 'A', value: 10, dataIndex: 0 },
    { name: 'x', seriesName: 'B', value: 30, dataIndex: 0 },
  ];

  it('sin nada que anadir se deja el de ECharts, que ya formatea igual', () => {
    expect(opciones({}, dos).tooltip.formatter).toBeUndefined();
  });

  it('el total es la suma de las series de ESA categoria', () => {
    const o = opciones({ tooltip: { total: true } }, dos);
    expect(o.tooltip.formatter(params)).toContain('Total: 40');
  });

  it('y al 100 % el total sale del modelo, no del porcentaje', () => {
    /*
     * Al 100 % el valor que ECharts pasa es la parte, no la cifra: sumando eso, el total de toda
     * categoria seria 100.
     */
    const o = opciones({ apilado: 'porcentaje', tooltip: { total: true } }, dos);
    const content = o.tooltip.formatter([
      { name: 'x', seriesName: 'A', value: 25, dataIndex: 0 },
      { name: 'x', seriesName: 'B', value: 75, dataIndex: 0 },
    ]);
    expect(content).toContain('Total: 40');
    expect(content).toContain('25.0 %');
  });

  it('ordenar pone la serie mayor arriba', () => {
    const o = opciones({ tooltip: { ordenarPorValor: true } }, dos);
    const content: string = o.tooltip.formatter(params);
    expect(content.indexOf('B:')).toBeLessThan(content.indexOf('A:'));
  });
});

describe('giro de los rotulos del eje', () => {
  it('sin girar, ECharts esconde los que no caben', () => {
    expect(opciones().xAxis.axisLabel.hideOverlap).toBe(true);
    expect(opciones().xAxis.axisLabel.rotate).toBeUndefined();
  });

  it('girados, se dejan de esconder: quien los gira lo hace para verlos todos', () => {
    const o = opciones({ ejes: { rotarX: 45 } });
    expect(o.xAxis.axisLabel.rotate).toBe(45);
    expect(o.xAxis.axisLabel.hideOverlap).toBe(false);
  });
});
