import { describe, expect, it } from 'vitest';
import { fiveNumberOf, numbersOf, quantile } from './statistics';

/** Los resumenes que comparten el histograma y el diagrama de caja. */

describe('el cuantil', () => {
  it('interpola entre los dos vecinos', () => {
    // La mediana de un numero par de observaciones es el promedio de las dos centrales.
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3], 0.5)).toBe(2);
  });

  it('en los extremos da el minimo y el maximo', () => {
    expect(quantile([4, 8, 15], 0)).toBe(4);
    expect(quantile([4, 8, 15], 1)).toBe(15);
  });

  it('sin observaciones no revienta', () => {
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe('numbersOf', () => {
  it('descarta lo que no es un numero finito', () => {
    expect(numbersOf([1, null, undefined, 2, Number.NaN, Number.POSITIVE_INFINITY])).toEqual([1, 2]);
  });
});

describe('el resumen de cinco numeros', () => {
  /** Uno a nueve, mas un atipico claro por arriba. */
  const CON_ATIPICO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];

  it('los cuartiles parten la lista en cuatro', () => {
    const r = fiveNumberOf([1, 2, 3, 4, 5]);

    expect(r?.q1).toBe(2);
    expect(r?.median).toBe(3);
    expect(r?.q3).toBe(4);
  });

  it('el bigote llega al dato mas lejano que TODAVIA esta dentro, no al limite calculado', () => {
    /*
     * Un bigote que termina donde no hay ningun dato dibuja un alcance que nadie midio: diria que
     * hubo un expediente de tantos dias cuando el mas largo de los normales fue otro.
     */
    const r = fiveNumberOf(CON_ATIPICO);

    expect(r?.high).toBe(9);
    expect(CON_ATIPICO).toContain(r?.high);
    expect(CON_ATIPICO).toContain(r?.low);
  });

  it('lo que queda fuera se nombra, no se esconde', () => {
    // Los expedientes absurdamente largos son lo que se busca, no ruido que quitar.
    expect(fiveNumberOf(CON_ATIPICO)?.outliers).toEqual([100]);
  });

  it('con la regla de los extremos el bigote llega al maximo y no hay atipicos', () => {
    const r = fiveNumberOf(CON_ATIPICO, 'extremos');

    expect(r?.high).toBe(100);
    expect(r?.low).toBe(1);
    expect(r?.outliers).toEqual([]);
  });

  it('la media va aparte de la mediana: juntas dicen si la distribucion esta sesgada', () => {
    const r = fiveNumberOf(CON_ATIPICO);

    expect(r?.median).toBe(5.5);
    // El atipico arrastra la media y deja la mediana donde estaba. Esa diferencia es el dato.
    expect(r?.mean).toBeGreaterThan(r?.median ?? 0);
  });

  it('cuenta las observaciones, atipicos incluidos', () => {
    expect(fiveNumberOf(CON_ATIPICO)?.count).toBe(10);
  });

  it('sin observaciones devuelve null, no una caja de ceros', () => {
    // Una caja en cero se dibujaria como un grupo que existe y mide cero, que es otra cosa.
    expect(fiveNumberOf([])).toBeNull();
    expect(fiveNumberOf([null, undefined])).toBeNull();
  });

  it('una sola observacion da una caja plana, sin atipicos', () => {
    const r = fiveNumberOf([7]);

    expect(r).toMatchObject({ low: 7, q1: 7, median: 7, q3: 7, high: 7, count: 1 });
    expect(r?.outliers).toEqual([]);
  });

  it('no depende del orden en que lleguen', () => {
    expect(fiveNumberOf([9, 1, 5, 3, 7])).toEqual(fiveNumberOf([1, 3, 5, 7, 9]));
  });
});
