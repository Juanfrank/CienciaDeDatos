import { describe, expect, it } from 'vitest';
import { MAX_BINS, binLabel, binPosition, histogramOf, suggestedBins } from './histogram';

/** El reparto en intervalos — la pieza que comparten el dibujo y el respaldo. */

/** 0..99, que reparte exacto en cualquier numero de intervalos pequeno. */
const CIEN = Array.from({ length: 100 }, (_, i) => i);

describe('el reparto en intervalos', () => {
  it('coloca cada observacion en uno y solo uno', () => {
    const h = histogramOf(CIEN, { bins: 4 });

    expect(h.bins).toHaveLength(4);
    expect(h.total).toBe(100);
    // Ni una observacion se pierde ni se cuenta dos veces: es la invariante del histograma.
    expect(h.bins.reduce((suma, b) => suma + b.count, 0)).toBe(100);
  });

  it('el maximo cae dentro: el ultimo intervalo cierra por la derecha', () => {
    const h = histogramOf([0, 5, 10], { bins: 2 });

    // Con intervalos [0,5) y [5,10], el 10 no pertenece a ninguno si el ultimo abre por la
    // derecha, y se perderia sin que nada fallara.
    expect(h.bins.map((b) => b.count)).toEqual([1, 2]);
  });

  it('los intervalos son contiguos y cubren el recorrido entero', () => {
    const h = histogramOf(CIEN, { bins: 5 });

    expect(h.bins[0]?.from).toBe(0);
    expect(h.bins[h.bins.length - 1]?.to).toBe(99);
    for (let i = 1; i < h.bins.length; i += 1) {
      expect(h.bins[i]?.from).toBeCloseTo(h.bins[i - 1]?.to ?? -1, 10);
    }
  });

  it('todas las observaciones en el mismo valor dan UN intervalo, no cero', () => {
    const h = histogramOf([7, 7, 7], { bins: 5 });

    // Repartir un recorrido de cero entre cinco daria cinco limites identicos y todo en el ultimo.
    expect(h.bins).toEqual([{ from: 7, to: 7, count: 3 }]);
  });

  it('sin observaciones no inventa intervalos', () => {
    expect(histogramOf([])).toEqual({ bins: [], displayed: [], total: 0 });
  });

  it('un hueco no es un cero: no ocupa intervalo', () => {
    const h = histogramOf([1, null, 2, undefined, 3], { bins: 1 });

    expect(h.total).toBe(3);
    expect(h.bins[0]?.count).toBe(3);
  });

  it('nunca pasa del tope de intervalos, ni pidiendolo', () => {
    expect(histogramOf(CIEN, { bins: 5000 }).bins.length).toBe(MAX_BINS);
    expect(histogramOf(CIEN, { bins: 0 }).bins.length).toBe(1);
  });
});

describe('cuantos intervalos cuando nadie lo dice', () => {
  it('los elige de los datos, no de una constante', () => {
    const pocos = suggestedBins([1, 2, 3, 4, 5]);
    const muchos = suggestedBins(Array.from({ length: 4000 }, (_, i) => i));

    expect(muchos).toBeGreaterThan(pocos);
  });

  it('un solo atipico no aplasta a los demas contra el primer intervalo', () => {
    // Es el motivo de usar Freedman-Diaconis y no el recorrido: mil casos entre 0 y 100, y un
    // expediente de diez anos. Con intervalos de anchura fija sobre el recorrido, los mil
    // primeros caerian en el mismo.
    const conAtipico = [...Array.from({ length: 1000 }, (_, i) => i % 100), 100000].sort(
      (a, b) => a - b,
    );
    const h = histogramOf(conAtipico);

    expect(h.bins.length).toBeGreaterThan(5);
  });

  it('con la mitad de las observaciones en el mismo valor, cae a Sturges', () => {
    // Recorrido intercuartilico cero: no hay anchura que sacar, y la formula daria una division
    // por cero disfrazada de intervalo infinito.
    const sorted = [...Array.from({ length: 50 }, () => 5), 1, 100].sort((a, b) => a - b);

    expect(suggestedBins(sorted)).toBeGreaterThan(0);
    expect(Number.isFinite(suggestedBins(sorted))).toBe(true);
  });
});

describe('lo que se dibuja de cada intervalo', () => {
  it('por defecto, cuantas observaciones caen dentro', () => {
    const h = histogramOf([0, 1, 2, 3], { bins: 2 });

    expect(h.displayed).toEqual(h.bins.map((b) => b.count));
  });

  it('acumulado, cuantas hay HASTA ese intervalo', () => {
    const h = histogramOf([0, 1, 2, 3], { bins: 2, cumulative: true });

    // Es lo que contesta «que parte se resolvio en menos de N dias».
    expect(h.displayed[h.displayed.length - 1]).toBe(h.total);
    expect(h.displayed).toEqual([2, 4]);
  });

  it('relativo, en porcentaje del total', () => {
    const h = histogramOf([0, 1, 2, 3], { bins: 2, relative: true });

    expect(h.displayed).toEqual([50, 50]);
  });

  it('acumulado y relativo a la vez terminan en el cien por cien', () => {
    const h = histogramOf(CIEN, { bins: 4, cumulative: true, relative: true });

    expect(h.displayed[h.displayed.length - 1]).toBeCloseTo(100, 10);
  });
});

describe('donde cae una referencia sobre el eje de intervalos', () => {
  const bins = histogramOf(CIEN, { bins: 4 }).bins;

  it('a media banda cuando el umbral cae a media banda', () => {
    // El centro del primer intervalo [0, 24.75) es la posicion 0; su borde izquierdo, -0.5.
    expect(binPosition(bins, bins[0]?.from ?? 0)).toBeCloseTo(-0.5, 10);
    expect(binPosition(bins, (bins[0]?.to ?? 0))).toBeCloseTo(0.5, 10);
  });

  it('avanza con el valor, sin saltos entre intervalos', () => {
    const posiciones = [0, 10, 25, 50, 75, 99].map((v) => binPosition(bins, v));

    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
  });

  it('un umbral fuera del recorrido se pega al borde, no desaparece', () => {
    // Quitarlo en silencio dejaria a quien lo configuro creyendo que la raya esta puesta.
    expect(binPosition(bins, -50)).toBe(-0.5);
    expect(binPosition(bins, 5000)).toBe(bins.length - 0.5);
  });

  it('sin intervalos no revienta', () => {
    expect(binPosition([], 10)).toBe(0);
  });
});

describe('el rotulo de un intervalo', () => {
  it('nombra sus dos limites con el formato de la medida', () => {
    expect(binLabel({ from: 0, to: 30, count: 1 }, (n) => `${n} d`)).toBe('0 d – 30 d');
  });

  it('un intervalo de un solo valor se dice una vez', () => {
    expect(binLabel({ from: 7, to: 7, count: 3 }, (n) => String(n))).toBe('7');
  });
});
