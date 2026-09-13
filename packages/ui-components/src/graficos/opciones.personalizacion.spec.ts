import { describe, expect, it } from 'vitest';
import { opcionesDe } from './opciones';
import { ordenarCategorias } from './orden';
import type { CategoricalViewModel } from '../registry/viewModel';

const paleta = {
  series: ['#1', '#2'],
  texto: '#t',
  textoAtenuado: '#ta',
  linea: '#l',
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
 *
 * Tipar ese objeto entero seria reescribir la definicion de ECharts para las cinco propiedades
 * que miran estas pruebas; `unknown` con un acceso por indice dice lo mismo sin ese coste.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ver el comentario de arriba */
const opciones = (extra: Record<string, unknown> = {}, v = vm(['A'], [['x', 1]])) =>
  opcionesDe('barras', { vm: v, paleta, titulo: 'T', ...extra }) as any;

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
    expect(ordenarCategorias(datos, undefined).points.map((p) => p.label)).toEqual(['b', 'a', 'c']);
  });

  it('por categoria y por valor, en las dos direcciones', () => {
    const etiquetas = (o: Parameters<typeof ordenarCategorias>[1]) =>
      ordenarCategorias(datos, o).points.map((p) => p.label);
    expect(etiquetas({ por: 'categoria' })).toEqual(['a', 'b', 'c']);
    expect(etiquetas({ por: 'categoria', direccion: 'desc' })).toEqual(['c', 'b', 'a']);
    expect(etiquetas({ por: 'valor' })).toEqual(['c', 'b', 'a']);
    expect(etiquetas({ por: 'valor', direccion: 'desc' })).toEqual(['a', 'b', 'c']);
  });

  it('los huecos van al final, se ordene como se ordene', () => {
    const conHueco = vm(['A'], [['a', null], ['b', 5], ['c', 0]]);
    // Tratar `null` como cero lo mezclaria con las categorias que valen cero de verdad, y
    // «no se puede calcular» y «vale cero» son cosas distintas.
    expect(ordenarCategorias(conHueco, { por: 'valor' }).points.map((p) => p.label)).toEqual(['c', 'b', 'a']);
    expect(ordenarCategorias(conHueco, { por: 'valor', direccion: 'desc' }).points.map((p) => p.label)).toEqual(['b', 'c', 'a']);
  });

  it('no muta el modelo recibido', () => {
    // El mismo `vm` alimenta al grafico y a su respaldo en HTML: mutarlo aqui reordenaria uno
    // de los dos a mitad de render.
    ordenarCategorias(datos, { por: 'valor' });
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
    const soloLeyenda = opciones({ leyenda: 'izquierda' });
    const ambos = opciones({ leyenda: 'izquierda', ejes: { tituloY: 'Casos' } });
    expect(ambos.grid.left).toBeGreaterThan(soloLeyenda.grid.left);
  });
});
