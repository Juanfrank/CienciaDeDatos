import { describe, expect, it } from 'vitest';
import { flowsOf, outgoingOf } from './sankey';
import type { CategoricalViewModel } from '../registry/viewModel';

/** El grafo de un diagrama de flujo. */

const vm = (puntos: [string, number | null][]): CategoricalViewModel => ({
  series: ['Casos'],
  aggregated: false,
  points: puntos.map(([label, valor]) => ({ label, values: [valor] })),
});

const PROCESO = vm([
  ['Ingreso / Audiencia', 100],
  ['Audiencia / Sentencia', 70],
  ['Audiencia / Archivo', 30],
]);

describe('el grafo sale de dos dimensiones', () => {
  it('la primera es de donde sale y la segunda a donde va', () => {
    const g = flowsOf(PROCESO);

    expect(g.nodes).toEqual(['Ingreso', 'Audiencia', 'Sentencia', 'Archivo']);
    expect(g.links).toHaveLength(3);
    expect(g.links[0]).toEqual({ source: 'Ingreso', target: 'Audiencia', value: 100 });
  });

  it('un flujo sin cifra no dibuja un enlace de grosor nulo', () => {
    // Una linea que no lleva nada dice que ese paso existe y no pasa nadie, que es otra cosa.
    expect(flowsOf(vm([['A / B', null], ['A / C', 0], ['A / D', 5]])).links).toHaveLength(1);
  });

  it('con UNA sola dimension no hay flujo que armar', () => {
    expect(flowsOf(vm([['Ingreso', 10]]))).toMatchObject({ nodes: [], links: [] });
  });

  it('cuanto sale de un nodo es la suma de sus ramas', () => {
    expect(outgoingOf(flowsOf(PROCESO), 'Audiencia')).toBe(100);
  });
});

describe('lo que no se puede dibujar se aparta CON NOMBRE', () => {
  it('un ciclo se detecta y se dice cual', () => {
    /*
     * En un proceso judicial los hay de verdad: una apelacion devuelve el expediente a primera
     * instancia. Dibujarlo deja el trazado dando vueltas; quitarlo en silencio dibuja un proceso
     * que no es el que hay, y quien lo lea creera que esa devolucion no ocurre.
     */
    const g = flowsOf(
      vm([
        ['Primera / Apelacion', 40],
        ['Apelacion / Primera', 10],
      ]),
    );

    expect(g.links).toHaveLength(1);
    expect(g.dropped).toEqual([
      { source: 'Apelacion', target: 'Primera', value: 10, why: 'ciclo' },
    ]);
  });

  it('un ciclo LARGO tambien: no basta con mirar el paso de vuelta', () => {
    const g = flowsOf(
      vm([
        ['A / B', 10],
        ['B / C', 10],
        ['C / A', 10],
      ]),
    );

    expect(g.links).toHaveLength(2);
    expect(g.dropped.map((d) => d.source)).toEqual(['C']);
  });

  it('una etapa que va a si misma', () => {
    const g = flowsOf(vm([['Audiencia / Audiencia', 5]]));

    expect(g.links).toEqual([]);
    expect(g.dropped[0]?.why).toBe('a-si-mismo');
  });

  it('dos ramas que se juntan NO son un ciclo', () => {
    // Un grafo dirigido aciclico admite que dos caminos lleguen al mismo sitio; confundirlo con un
    // ciclo quitaria enlaces perfectamente dibujables.
    const g = flowsOf(
      vm([
        ['A / C', 1],
        ['B / C', 2],
      ]),
    );

    expect(g.links).toHaveLength(2);
    expect(g.dropped).toEqual([]);
  });

  it('un proceso sin ciclos no aparta nada', () => {
    expect(flowsOf(PROCESO).dropped).toEqual([]);
  });
});
