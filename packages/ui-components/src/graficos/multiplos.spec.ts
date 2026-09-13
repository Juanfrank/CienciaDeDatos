import { describe, expect, it } from 'vitest';
import { columnasPara, maximoComun, partirEnMultiplos } from './multiplos';
import type { CategoricalViewModel } from '../registry/viewModel';

const vm = (puntos: [string, ...(number | null)[]][]): CategoricalViewModel => ({
  series: ['Casos'],
  points: puntos.map(([label, ...values]) => ({ label, values })),
  aggregated: false,
});

describe('partir en paneles', () => {
  it('el primer trozo de la etiqueta es el panel y el segundo la categoria', () => {
    const paneles = partirEnMultiplos(
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
    const paneles = partirEnMultiplos(vm([['Penal / Ordinario / Q1', 10]]));
    expect(paneles[0]?.titulo).toBe('Penal');
    expect(paneles[0]?.vm.points[0]?.label).toBe('Ordinario / Q1');
  });

  it('sin segunda dimension devuelve un solo panel, no cero', () => {
    // Asi el render no tiene que preguntarse si el mapeo trae multiplo: siempre recibe paneles.
    const original = vm([['Q1', 10]]);
    const paneles = partirEnMultiplos(original);
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
    const paneles = partirEnMultiplos(vm([['A / x', 20], ['B / x', 2000]]));
    expect(maximoComun(paneles)).toBe(2000);
  });

  it('los nulos no entran: no son cero', () => {
    const paneles = partirEnMultiplos(vm([['A / x', null], ['B / x', 30]]));
    expect(maximoComun(paneles)).toBe(30);
  });

  it('sin ni un valor NO se inventa un maximo', () => {
    // Un panel vacio con el eje clavado en cero se lee como «cero casos», que es una afirmacion
    // distinta de «no hay datos».
    expect(maximoComun(partirEnMultiplos(vm([['A / x', null]])))).toBeUndefined();
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
