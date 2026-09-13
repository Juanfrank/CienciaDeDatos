import { describe, expect, it } from 'vitest';
import { escalaBonita, opcionesDe } from './opciones';
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

/* eslint-disable @typescript-eslint/no-explicit-any -- se comprueba la forma que consume ECharts */
const circular = (extra: Record<string, unknown> = {}, v = vm(['Casos'], [['A', 30], ['B', 70]])) =>
  opcionesDe('circular', { vm: v, paleta, titulo: 'T', ...extra }) as any;

const medidor = (extra: Record<string, unknown> = {}, v = vm(['Casos'], [['', 40, 100]])) =>
  opcionesDe('medidor', { vm: v, paleta, titulo: 'T', ...extra }) as any;

describe('circular: pastel y dona', () => {
  it('el hueco del centro distingue un pastel de una dona, y nada mas', () => {
    expect(circular().series[0].radius[0]).toBe('0%');
    expect(circular({ circular: { radioInterior: 55 } }).series[0].radius[0]).toBe('55%');
  });

  it('el hueco se acota: por encima del limite no queda anillo que comparar', () => {
    expect(circular({ circular: { radioInterior: 300 } }).series[0].radius[0]).toBe('80%');
    expect(circular({ circular: { radioInterior: -20 } }).series[0].radius[0]).toBe('0%');
  });

  it('ordena las porciones de mayor a menor por defecto', () => {
    // Dos areas parecidas solo se distinguen si estan una al lado de la otra.
    expect(circular().series[0].data.map((d: { name: string }) => d.name)).toEqual(['B', 'A']);
    expect(
      circular({ circular: { ordenar: false } }).series[0].data.map((d: { name: string }) => d.name),
    ).toEqual(['A', 'B']);
  });

  it('un valor nulo NO se dibuja como cero: se descarta', () => {
    /*
     * Es lo que mas importa de todo el objeto. `null` es «no hay respuesta»; una porcion de
     * tamano cero AFIRMA que esa categoria no aporto nada. Y ademas el nulo cambiaria el total
     * del que todas las demas porciones son porcentaje.
     */
    const o = circular({}, vm(['Casos'], [['A', 30], ['B', null], ['C', 70]]));
    expect(o.series[0].data.map((d: { name: string }) => d.name)).toEqual(['C', 'A']);
  });

  it('la leyenda nombra CATEGORIAS, asi que auto la ensena con una sola serie', () => {
    // `auto` mira cuantas series hay y en un circular siempre hay una: sin esto, un pastel salia
    // siempre como una rueda de colores sin nombre.
    expect(circular().legend.show).not.toBe(false);
    // Con una sola porcion no hay nada que distinguir.
    expect(circular({}, vm(['Casos'], [['A', 30]])).legend.show).toBe(false);
  });

  it('el total en el centro solo se dibuja si hay centro donde ponerlo', () => {
    expect(circular({ circular: { totalEnElCentro: true } }).title).toBeUndefined();
    const conHueco = circular({ circular: { totalEnElCentro: true, radioInterior: 55 } });
    expect(conHueco.title.text).toBe('100');
  });

  it('el total del centro usa el formateador de la medida', () => {
    const o = circular({
      circular: { totalEnElCentro: true, radioInterior: 55 },
      formatear: (n: number) => `${n} casos`,
    });
    expect(o.title.text).toBe('100 casos');
  });

  it('el tooltip da la cifra Y la parte: un porcentaje suelto no se puede auditar', () => {
    const texto = circular({ formatear: (n: number) => `${n} casos` }).tooltip.formatter({
      name: 'A',
      value: 30,
      percent: 30,
    });
    expect(texto).toContain('30 casos');
    expect(texto).toContain('30 %');
  });
});

describe('medidor', () => {
  it('la escala se redondea hacia arriba a un numero estable', () => {
    /*
     * Con el maximo pegado a los datos, 2.216 y 2.220 dibujan la misma aguja en el mismo sitio y
     * dos capturas dejan de ser comparables.
     */
    expect(escalaBonita(2216)).toBe(2500);
    expect(escalaBonita(1)).toBe(1);
    expect(escalaBonita(11)).toBe(20);
    expect(escalaBonita(0)).toBe(1);
    expect(escalaBonita(-5)).toBe(1);
  });

  it('el minimo y el maximo fijados mandan sobre lo deducido', () => {
    const o = medidor({ medidor: { minimo: 10, maximo: 500 } });
    expect(o.series[0].min).toBe(10);
    expect(o.series[0].max).toBe(500);
  });

  it('la segunda medida es el objetivo y se dibuja como marca, no como segunda aguja', () => {
    const o = medidor();
    expect(o.series).toHaveLength(2);
    expect(o.series[1].data[0].value).toBe(100);
    expect(o.series[1].pointer.icon).toBe('rect');
    // La marca no responde al raton: no es un dato que se consulte, es una referencia.
    expect(o.series[1].silent).toBe(true);
  });

  it('sin objetivo no hay marca', () => {
    expect(medidor({}, vm(['Casos'], [['', 40]])).series).toHaveLength(1);
  });

  it('el objetivo del dataset manda sobre el escrito a mano', () => {
    // Un numero de la configuracion no se actualiza; el del dataset si.
    expect(medidor({ medidor: { objetivo: 7 } }).series[1].data[0].value).toBe(100);
    expect(
      medidor({ medidor: { objetivo: 7 } }, vm(['Casos'], [['', 40]])).series[1].data[0].value,
    ).toBe(7);
  });

  it('un valor nulo se dibuja como raya y no como cero', () => {
    const o = medidor({}, vm(['Casos'], [['', null, 100]]));
    expect(o.series[0].detail.formatter(0)).toBe('—');
  });

  it('solo rotula los extremos de la escala', () => {
    // Con la escala entera rotulada, en una tarjeta de dos filas los numeros se pisan.
    expect(medidor().series[0].splitNumber).toBe(1);
    expect(medidor().series[0].splitLine.show).toBe(false);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any -- se comprueba la forma que consume ECharts */
const combinado = (
  extra: Record<string, unknown> = {},
  v = vm(['Ingresados', 'Resueltos', 'Pendientes'], [['Q1', 10, 8, 900]]),
) => opcionesDe('combinado', { vm: v, paleta, titulo: 'T', seriesDeColumna: 2, ...extra }) as any;

const dispersion = (
  extra: Record<string, unknown> = {},
  v = vm(['X', 'Y', 'Tamano'], [['Q1', 10, 8, 4], ['Q2', 20, 16, 8]]),
) => opcionesDe('dispersion', { vm: v, paleta, titulo: 'T', ...extra }) as any;

describe('combinado de columnas y lineas', () => {
  it('el mapeo decide la forma: las primeras son barras y el resto linea', () => {
    const tipos = combinado().series.map((s: { type: string }) => s.type);
    expect(tipos).toEqual(['bar', 'bar', 'line']);
  });

  it('sin eje secundario hay UN eje de valores y ninguna serie se va a otro', () => {
    const o = combinado();
    expect(Array.isArray(o.yAxis)).toBe(false);
    expect(o.series[2].yAxisIndex).toBeUndefined();
  });

  it('con eje secundario solo las LINEAS cambian de escala', () => {
    // Al reves, la magnitud principal cambiaria de escala sin avisar.
    const o = combinado({ combinado: { ejeSecundario: true } });
    expect(o.yAxis).toHaveLength(2);
    expect(o.yAxis[1].position).toBe('right');
    expect(o.series[0].yAxisIndex).toBeUndefined();
    expect(o.series[2].yAxisIndex).toBe(1);
  });

  it('el segundo eje no repite la cuadricula', () => {
    // Dos rejillas superpuestas a distinta altura convierten el fondo en ruido.
    const o = combinado({ combinado: { ejeSecundario: true } });
    expect(o.yAxis[1].splitLine.show).toBe(false);
  });

  it('la linea se dibuja por encima de las columnas', () => {
    expect(combinado().series[2].z).toBeGreaterThan(0);
  });

  it('mas columnas que series no desborda', () => {
    const o = combinado({ seriesDeColumna: 99 });
    expect(o.series.every((s: { type: string }) => s.type === 'bar')).toBe(true);
  });
});

describe('dispersion', () => {
  it('cada categoria es un punto, y los dos ejes son medidas', () => {
    const o = dispersion();
    expect(o.xAxis.type).toBe('value');
    expect(o.yAxis.type).toBe('value');
    expect(o.series[0].data).toHaveLength(2);
    /*
     * Cada punto es un OBJETO con `name`, no un array suelto: como array, el evento de clic de
     * ECharts llega con el nombre vacio y el filtrado cruzado no hace nada. Se veia el gesto y no
     * pasaba nada, que es peor que no ofrecerlo.
     */
    expect(o.series[0].data[0]).toEqual({ name: 'Q1', value: [10, 8, 4] });
  });

  it('la tercera medida reparte el diametro entre un minimo y un maximo', () => {
    /*
     * Y no se usa como radio en crudo: el area de un circulo crece con el cuadrado del radio, asi
     * que un valor cuatro veces mayor se veria dieciseis veces mas grande.
     */
    const tamano = dispersion().series[0].symbolSize;
    expect(typeof tamano).toBe('function');
    const pequeno = tamano([10, 8, 4]);
    const grande = tamano([20, 16, 8]);
    expect(grande).toBeGreaterThan(pequeno);
    expect(pequeno).toBeGreaterThanOrEqual(8);
    expect(grande).toBeLessThanOrEqual(42);
  });

  it('sin tercera medida, todos los puntos miden lo mismo', () => {
    const o = dispersion({}, vm(['X', 'Y'], [['Q1', 10, 8]]));
    expect(typeof o.series[0].symbolSize).toBe('number');
  });

  it('el tooltip nombra las medidas, no «x» e «y»', () => {
    // En una dispersion no hay rotulo de categoria en el eje que lo diga, como si lo hay en barras.
    const texto = dispersion().tooltip.formatter({ name: 'Q1', value: [10, 8, 4] });
    expect(texto).toContain('Q1');
    expect(texto).toContain('X: 10');
    expect(texto).toContain('Y: 8');
  });
});

const embudo = (
  extra: Record<string, unknown> = {},
  v = vm(['Casos'], [['Q1', 1000], ['Q2', 800], ['Q3', 400]]),
) => opcionesDe('embudo', { vm: v, paleta, titulo: 'T', ...extra }) as any;

const cascada = (
  extra: Record<string, unknown> = {},
  v = vm(['Casos'], [['A', 100], ['B', -40], ['C', 30]]),
) => opcionesDe('cascada', { vm: v, paleta, titulo: 'T', ...extra }) as any;

const arbol = (extra: Record<string, unknown> = {}, v = vm(['Casos'], [['Penal / Q1', 10]])) =>
  opcionesDe('mapa-de-arbol', { vm: v, paleta, titulo: 'T', ...extra }) as any;

describe('embudo', () => {
  it('NO reordena las etapas', () => {
    /*
     * Es la diferencia con un circular. Las etapas de un proceso tienen un orden propio, y que la
     * segunda sea mayor que la primera es una anomalia que hay que poder VER.
     */
    expect(embudo().series[0].sort).toBe('none');
    const o = embudo({}, vm(['Casos'], [['Q1', 100], ['Q2', 500]]));
    expect(o.series[0].data.map((d: { name: string }) => d.name)).toEqual(['Q1', 'Q2']);
  });

  it('compara contra la primera etapa por defecto', () => {
    const texto = embudo().series[0].label.formatter({ name: 'Q3', value: 400, dataIndex: 2 });
    expect(texto).toContain('40.0 %');
  });

  it('y contra la anterior cuando se pide', () => {
    // Dos preguntas distintas: «cuanto queda de lo que entro» y «cuanto se pierde en ESTE paso».
    const o = embudo({ embudo: { comparar: 'anterior' } });
    expect(o.series[0].label.formatter({ name: 'Q3', value: 400, dataIndex: 2 })).toContain('50.0 %');
  });

  it('una etapa de referencia en cero da raya, no una caida infinita', () => {
    const o = embudo({ embudo: { comparar: 'anterior' } }, vm(['Casos'], [['Q1', 0], ['Q2', 50]]));
    expect(o.series[0].label.formatter({ name: 'Q2', value: 50, dataIndex: 1 })).toContain('—');
  });
});

describe('cascada', () => {
  it('cada barra empieza donde acabo la anterior', () => {
    const [zocalo, visible] = cascada().series;
    // 100 sube desde 0; -40 cuelga desde 60; 30 sube desde 60. El total, desde cero.
    expect(zocalo.data).toEqual([0, 60, 60, 0]);
    expect(visible.data.map((d: { value: number }) => d.value)).toEqual([100, 40, 30, 90]);
  });

  it('el zocalo es invisible, mudo y no sale en la leyenda', () => {
    const o = cascada();
    expect(o.series[0].itemStyle.color).toBe('transparent');
    expect(o.series[0].silent).toBe(true);
    expect(o.legend.show).toBe(false);
  });

  it('el signo va SIEMPRE en la etiqueta, no solo en el color', () => {
    /*
     * WCAG 1.4.1: impreso en gris, o para quien no separa rojo y verde, «+40» y «-40» serian la
     * misma barra si el color fuera lo unico que los distingue.
     */
    const etiqueta = cascada().series[1].label.formatter;
    expect(etiqueta({ dataIndex: 0 })).toBe('+100');
    expect(etiqueta({ dataIndex: 1 })).toBe('-40');
    // El total no lleva signo: no es una contribucion, es a donde se llega.
    expect(etiqueta({ dataIndex: 3 })).toBe('90');
  });

  it('sin la barra de total, la cascada acaba en la ultima contribucion', () => {
    const o = cascada({ cascada: { mostrarTotal: false } });
    expect(o.series[1].data).toHaveLength(3);
    expect(o.xAxis.data).toEqual(['A', 'B', 'C']);
  });
});

describe('mapa de arbol', () => {
  it('con dos dimensiones dibuja dos niveles', () => {
    const o = arbol({}, vm(['Casos'], [['Penal / Q1', 10], ['Penal / Q2', 5], ['Civil / Q1', 8]]));
    expect(o.series[0].data).toHaveLength(2);
    expect(o.series[0].data[0].children).toHaveLength(2);
    expect(o.series[0].upperLabel.show).toBe(true);
  });

  it('con una sola, un nivel plano', () => {
    const o = arbol({}, vm(['Casos'], [['Penal', 10], ['Civil', 8]]));
    expect(o.series[0].data).toEqual([
      { name: 'Penal', value: 10 },
      { name: 'Civil', value: 8 },
    ]);
    expect(o.series[0].upperLabel.show).toBe(false);
  });

  it('un nulo no es un rectangulo de area cero: no se dibuja', () => {
    const o = arbol({}, vm(['Casos'], [['Penal', 10], ['Civil', null]]));
    expect(o.series[0].data).toHaveLength(1);
  });

  it('sin zoom ni migas: el estado de lo que se ve vive en la URL (4.11)', () => {
    // Un zoom que no esta en la direccion no se comparte ni se marca.
    expect(arbol().series[0].roam).toBe(false);
    expect(arbol().series[0].breadcrumb.show).toBe(false);
  });
});
