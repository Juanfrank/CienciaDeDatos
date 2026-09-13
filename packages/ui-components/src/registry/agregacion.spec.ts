import { describe, expect, it } from 'vitest';
import { AGGREGATIONS, type QueryResult } from '@app/data-contracts';
import {
  agregacionesDe,
  agregacionesPara,
  agregacionesPosibles,
  validarAgregacion,
} from './agregacion';
import { aggregateBy, toKpi, toMatrix } from './viewModel';

/** El fallo que estas pruebas fijan tenia un numero concreto. */

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };

/** Tres casos del Norte y uno del Sur, con sus dias. Grano atomico: una fila por caso. */
const casos: QueryResult = {
  columns: [
    { name: 'FactCasos.CasoId', type: 'string' },
    { name: 'DimTribunal.Distrito', type: 'string' },
    { name: 'DiasResolucion', type: 'number' },
  ],
  rows: [
    ['C-1', 'Norte', 100],
    ['C-2', 'Norte', 200],
    ['C-3', 'Norte', 300],
    ['C-4', 'Sur', 50],
  ],
  source: 'mock',
  generatedAt: '2026-09-12T08:00:00.000Z',
};

describe('el operador decide, y el resultado cambia', () => {
  it('promedia en vez de sumar cuando la medida se declara promedio', () => {
    const { rows } = aggregateBy(casos, [DISTRITO], ['DiasResolucion'], ['promedio']);
    expect(rows.map((f) => [f.labels[0], f.values[0]])).toEqual([
      ['Norte', 200],
      ['Sur', 50],
    ]);
  });

  it('la MISMA llamada con suma da otra cifra: el operador no es cosmetico', () => {
    const { rows } = aggregateBy(casos, [DISTRITO], ['DiasResolucion'], ['suma']);
    expect(rows[0]?.values[0]).toBe(600);
  });

  it('una tarjeta colapsa el dataset entero y promedia sobre los casos, no sobre los grupos', () => {
    // Es el caso exacto del fallo: sin dimensiones, todas las filas caen en un solo grupo.
    expect(toKpi(casos, ['DiasResolucion'], 'Dias', ['promedio']).value).toBe(162.5);
    expect(toKpi(casos, ['DiasResolucion'], 'Dias', ['suma']).value).toBe(650);
  });

  it('minimo, maximo, recuento y recuento distinto', () => {
    const de = (aggregation: Parameters<typeof aggregateBy>[3][number]) =>
      aggregateBy(casos, [DISTRITO], ['DiasResolucion'], [aggregation]).rows[0]?.values[0];
    expect(de('minimo')).toBe(100);
    expect(de('maximo')).toBe(300);
    expect(de('recuento')).toBe(3);
    expect(
      aggregateBy(casos, [DISTRITO], ['FactCasos.CasoId'], ['recuento-distinto']).rows[0]?.values[0],
    ).toBe(3);
  });

  it('el recuento distinto cuenta el valor tal cual, no su conversion a numero', () => {
    // Con `Number('C-1')` y `Number('C-2')` los dos identificadores darian NaN -> 0 y contarian
    // como uno solo. El distinto es sobre el valor, no sobre el numero que no es.
    const { rows } = aggregateBy(casos, [], ['FactCasos.CasoId'], ['recuento-distinto']);
    expect(rows[0]?.values[0]).toBe(4);
  });
});

describe('«ninguna»: lo que la fuente ya calculo', () => {
  it('se devuelve tal cual si el objeto NO colapsa', () => {
    const { rows } = aggregateBy(
      casos,
      [{ table: 'FactCasos', field: 'CasoId' }],
      ['DiasResolucion'],
      ['ninguna'],
    );
    expect(rows.map((f) => f.values[0])).toEqual([100, 200, 300, 50]);
  });

  it('queda en null —no en cero, ni en el primero— si el objeto colapsa', () => {
    // Devolver la suma o el primer valor seria inventar una cifra que nadie calculo. `null` es
    // «no hay respuesta», y aguas abajo se dibuja como raya.
    const { rows } = aggregateBy(casos, [DISTRITO], ['DiasResolucion'], ['ninguna']);
    expect(rows[0]?.values[0]).toBeNull();
    expect(rows[1]?.values[0]).toBe(50);
  });
});

describe('el conjunto vacio', () => {
  const vacio = { ...casos, rows: [] };

  it('la suma de cero filas es cero; el promedio de cero filas no existe', () => {
    expect(toKpi(vacio, ['DiasResolucion'], 'x', ['suma']).value).toBe(0);
    expect(toKpi(vacio, ['DiasResolucion'], 'x', ['promedio']).value).toBeNull();
  });
});

describe('los totales de una matriz salen de las filas de origen', () => {
  /*
   * Con la suma daba igual —la suma de las celdas es la suma total—, pero con un promedio no: el
   * promedio de una fila es el de sus registros, no el de los promedios de sus celdas, que solo
   * coincide si todas las celdas pesan lo mismo. Aqui no pesan igual, y por eso la prueba lo
   * distingue: el promedio de las cuatro filas es 162,5; el de los dos promedios de celda, 125.
   */
  const MATERIA = { table: 'DimTribunal', field: 'Materia' };
  const conMateria: QueryResult = {
    columns: [...casos.columns, { name: 'DimTribunal.Materia', type: 'string' }],
    rows: [
      ['C-1', 'Norte', 100, 'Penal'],
      ['C-2', 'Norte', 200, 'Penal'],
      ['C-3', 'Norte', 300, 'Penal'],
      ['C-4', 'Norte', 50, 'Civil'],
    ],
    source: 'mock',
    generatedAt: casos.generatedAt,
  };

  it('el total de fila no es el promedio de los promedios de celda', () => {
    const m = toMatrix(conMateria, [DISTRITO, MATERIA], 'DiasResolucion', 'promedio');
    expect(m.cells[0]).toEqual([200, 50]);
    expect(m.rowTotals[0]).toBe(162.5);
    expect(m.grandTotal).toBe(162.5);
  });
});

describe('de donde sale el operador de cada medida', () => {
  it('manda lo elegido en el pozo; si no, lo que declara el esquema; si no, suma', () => {
    const declaradas = new Map([['DiasResolucion', 'promedio' as const]]);
    expect(agregacionesDe(['DiasResolucion'], declaradas, undefined)).toEqual(['promedio']);
    expect(agregacionesDe(['DiasResolucion'], declaradas, { DiasResolucion: 'maximo' })).toEqual([
      'maximo',
    ]);
    expect(agregacionesDe(['Otra'], declaradas, undefined)).toEqual(['suma']);
  });

  it('se reordena POR NOMBRE, porque los objetos consumen sus medidas por ranura', () => {
    // Una tarjeta pide primero la del pozo «valor» y luego la de «comparacion», que en el mapeo
    // pueden estar al reves. Casar por indice le daria a cada medida el operador de la otra.
    expect(
      agregacionesPara(['B', 'A'], ['A', 'B'], ['suma', 'promedio']),
    ).toEqual(['promedio', 'suma']);
  });
});

describe('validarAgregacion: lo que no se puede guardar', () => {
  const base = { measures: ['DiasResolucion'], colapsa: true };

  it('un promedio sobre un dataset YA agrupado se rechaza', () => {
    const problems = validarAgregacion({
      ...base,
      aggregations: ['promedio'],
      dataGrain: 'preagregado',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.issue).toMatch(/ya agrupado/);
  });

  it('el mismo promedio sobre grano atomico se acepta', () => {
    expect(validarAgregacion({ ...base, aggregations: ['promedio'], dataGrain: 'atomico' })).toEqual([]);
  });

  it('las aditivas se aceptan sobre cualquier grano', () => {
    for (const aggregation of ['suma', 'minimo', 'maximo'] as const) {
      expect(
        validarAgregacion({ ...base, aggregations: [aggregation], dataGrain: 'preagregado' }),
      ).toEqual([]);
    }
  });

  it('una medida ya calculada por la fuente se rechaza en cuanto el objeto colapsa', () => {
    expect(
      validarAgregacion({ ...base, aggregations: ['ninguna'], dataGrain: 'atomico' }),
    ).toHaveLength(1);
  });

  it('sin colapso no hay nada que comprobar: el objeto dibuja una fila por fila', () => {
    expect(
      validarAgregacion({
        measures: ['DiasResolucion'],
        aggregations: ['ninguna'],
        colapsa: false,
        dataGrain: 'preagregado',
      }),
    ).toEqual([]);
  });
});

describe('agregacionesPosibles: lo que el editor puede OFRECER', () => {
  /*
   * La lista del desplegable y la validacion que rechaza al guardar salen de la misma funcion.
   * Con dos implementaciones, el editor acabaria ofreciendo algo que la validacion rechaza — o
   * peor, al reves: prohibiendo en el desplegable algo que si se puede.
   */
  it('sobre grano preagregado solo ofrece las aditivas', () => {
    expect(agregacionesPosibles({ colapsa: true, dataGrain: 'preagregado' })).toEqual([
      'suma',
      'minimo',
      'maximo',
    ]);
  });

  it('sobre grano atomico ofrece todas menos «sin resumir»', () => {
    const posibles = agregacionesPosibles({ colapsa: true, dataGrain: 'atomico' });
    expect(posibles).toContain('promedio');
    expect(posibles).toContain('recuento-distinto');
    expect(posibles).not.toContain('ninguna');
  });

  it('sin colapso las ofrece todas: el objeto no combina nada', () => {
    expect(agregacionesPosibles({ colapsa: false, dataGrain: 'preagregado' })).toHaveLength(7);
  });

  it('lo que NO se ofrece es exactamente lo que la validacion rechaza', () => {
    // La invariante que impide que las dos reglas se separen.
    for (const dataGrain of ['atomico', 'preagregado'] as const) {
      for (const colapsa of [true, false]) {
        const posibles = agregacionesPosibles({ colapsa, dataGrain });
        for (const aggregation of AGGREGATIONS) {
          const problems = validarAgregacion({
            measures: ['m'],
            aggregations: [aggregation],
            colapsa,
            dataGrain,
          });
          expect(problems.length === 0).toBe(posibles.includes(aggregation));
        }
      }
    }
  });
});
