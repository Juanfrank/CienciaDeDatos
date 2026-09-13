import { describe, expect, it } from 'vitest';
import { MAX_PANELES, columnasPara, maximoComun, partirEnMultiplos } from './multiplos';
import type { CategoricalViewModel } from '../registry/viewModel';

const vm = (puntos: [string, ...(number | null)[]][]): CategoricalViewModel => ({
  series: ['Casos'],
  points: puntos.map(([label, ...values]) => ({ label, values })),
  aggregated: false,
});

describe('partir en paneles', () => {
  it('el primer trozo de la etiqueta es el panel y el segundo la categoria', () => {
    const { paneles } = partirEnMultiplos(
      vm([
        ['Penal / Q1', 10],
        ['Penal / Q2', 20],
        ['Civil / Q1', 5],
      ]),
    );

    expect(paneles.map((p) => p.titulo)).toEqual(['Penal', 'Civil']);
    expect(paneles[0]?.vm.points.map((p) => p.label)).toEqual(['Q1', 'Q2']);
    expect(paneles[1]?.vm.points).toHaveLength(1);
  });

  it('una categoria que lleva el separador dentro no se parte dos veces', () => {
    /*
     * «Camara Penal 1 / Ordinario / Q1» tiene dos separadores y sigue siendo UN panel con una
     * categoria compuesta. Partiendo por todos, la categoria se perderia y los puntos de dos
     * paneles distintos se mezclarian bajo el mismo nombre.
     */
    const { paneles } = partirEnMultiplos(vm([['Penal / Ordinario / Q1', 10]]));
    expect(paneles[0]?.titulo).toBe('Penal');
    expect(paneles[0]?.vm.points[0]?.label).toBe('Ordinario / Q1');
  });

  it('sin segunda dimension devuelve un solo panel, no cero', () => {
    // Asi el render no tiene que preguntarse si el mapeo trae multiplo: siempre recibe paneles.
    const original = vm([['Q1', 10]]);
    const { paneles } = partirEnMultiplos(original);
    expect(paneles).toHaveLength(1);
    expect(paneles[0]?.vm).toBe(original);
  });
});

describe('escala comun', () => {
  it('el maximo sale de TODOS los paneles, que es lo que los hace comparables', () => {
    /*
     * Con escalas independientes, dos paneles de alturas parecidas pueden estar diciendo 20 y
     * 2.000 — y la comparacion, que es la unica razon de ponerlos juntos, sale al reves.
     */
    const { paneles } = partirEnMultiplos(vm([['A / x', 20], ['B / x', 2000]]));
    expect(maximoComun(paneles)).toBe(2000);
  });

  it('los nulos no entran: no son cero', () => {
    const { paneles } = partirEnMultiplos(vm([['A / x', null], ['B / x', 30]]));
    expect(maximoComun(paneles)).toBe(30);
  });

  it('sin ni un valor NO se inventa un maximo', () => {
    // Un panel vacio con el eje clavado en cero se lee como «cero casos», que es una afirmacion
    // distinta de «no hay datos».
    expect(maximoComun(partirEnMultiplos(vm([['A / x', null]])).paneles)).toBeUndefined();
  });
});

describe('la rejilla', () => {
  it('se elige la mas cuadrada', () => {
    expect(columnasPara(4)).toBe(2);
    expect(columnasPara(9)).toBe(3);
    expect(columnasPara(2)).toBe(2);
    expect(columnasPara(1)).toBe(1);
  });

  it('nunca pasa de cuatro columnas, aunque se pidan mas', () => {
    // Mas de cuatro deja cada panel tan estrecho que sus rotulos dejan de caber, y entonces los
    // multiplos cuestan mas de lo que ahorran.
    expect(columnasPara(25)).toBe(4);
    expect(columnasPara(6, 8)).toBe(4);
  });

  it('lo pedido manda sobre lo deducido', () => {
    expect(columnasPara(9, 2)).toBe(2);
  });
});

describe('el limite de paneles', () => {
  const muchos = (n: number) =>
    vm(Array.from({ length: n }, (_, i) => [`G${i} / x`, i + 1] as [string, number]));

  it('no se montan mas de doce: cada panel es una instancia de ECharts', () => {
    /*
     * Una dimension con cincuenta valores montaria cincuenta instancias en UNA tarjeta, y eso no
     * es un grafico lento sino un navegador bloqueado. Ademas, cincuenta graficos del tamano de
     * un sello no dicen nada — que es el motivo que de verdad importa.
     */
    const { paneles } = partirEnMultiplos(muchos(50));
    expect(paneles).toHaveLength(MAX_PANELES);
  });

  it('y lo que no cabe se CUENTA, para poder decirlo', () => {
    // Recortar en silencio deja a quien mira creyendo que la dimension tiene doce valores.
    expect(partirEnMultiplos(muchos(50)).omitidos).toBe(50 - MAX_PANELES);
    expect(partirEnMultiplos(muchos(3)).omitidos).toBe(0);
  });

  it('se quedan los PRIMEROS del orden vigente, no los mayores', () => {
    /*
     * «Los mayores» seria una decision tomada a espaldas de quien edita: el orden lo fija el
     * panel, y respetarlo significa que para ver otros doce basta con cambiarlo.
     */
    const { paneles } = partirEnMultiplos(muchos(20));
    expect(paneles[0]?.titulo).toBe('G0');
    expect(paneles.at(-1)?.titulo).toBe(`G${MAX_PANELES - 1}`);
  });

  it('la escala comun sale de los paneles QUE SE DIBUJAN', () => {
    /*
     * Si saliera de todos, los doce visibles se comprimirian contra el maximo de uno que no se
     * ve: el grafico quedaria plano por culpa de un dato ausente de la pantalla.
     */
    const { paneles } = partirEnMultiplos(muchos(50));
    expect(maximoComun(paneles)).toBe(MAX_PANELES);
  });
});
