import type { QueryResult } from '@app/data-contracts';
import { describe, expect, it } from 'vitest';
import { breakdownOf, projectObject } from './projection';
import type { ObjectInstance } from './types';

/** Lo que se vigila aqui es que lo proyectado sea LO QUE EL OBJETO MUESTRA. */

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };
const MATERIA = { table: 'DimTribunal', field: 'Materia' };

/** Dataset con MAS granularidad de la que muestran los objetos: cuatro trimestres por celda. */
const datos: QueryResult = {
  columns: [
    { name: 'DimTribunal.Distrito', type: 'string' },
    { name: 'DimTribunal.Materia', type: 'string' },
    { name: 'DimTiempo.Trimestre', type: 'string' },
    { name: 'CasosPendientes', type: 'number' },
    { name: 'CasosIngresados', type: 'number' },
  ],
  rows: [
    ['Norte', 'Penal', 'Q1', 10, 100],
    ['Norte', 'Penal', 'Q2', 5, 50],
    ['Norte', 'Civil', 'Q1', 20, 200],
    ['Sur', 'Penal', 'Q1', 30, 300],
  ],
  source: 'mock',
  generatedAt: '2026-03-01T10:00:00.000Z',
};

const objectInstance = (parcial: Partial<ObjectInstance>): ObjectInstance => ({
  instanceId: 'i1',
  objectId: 'barras',
  version: '1.0.0',
  binding: { datasetId: 'casos', dimensions: [DISTRITO], measures: ['CasosPendientes'] },
  ...parcial,
});

describe('projectObject', () => {
  it('una tarjeta KPI proyecta UNA fila, no las filas del dataset', () => {
    const projected = projectObject(
      objectInstance({
        objectId: 'tarjeta-kpi',
        title: 'Casos pendientes',
        binding: { datasetId: 'casos', dimensions: [], measures: ['CasosPendientes'] },
      }),
      datos,
      ['suma', 'suma'],
    );

    expect(projected.columns.map((c) => c.name)).toEqual(['Indicador', 'CasosPendientes']);
    expect(projected.rows).toEqual([['Casos pendientes', 65]]);
  });

  it('una tarjeta con comparacion proyecta las dos medidas', () => {
    const projected = projectObject(
      objectInstance({
        objectId: 'tarjeta-kpi',
        title: 'Ingresados vs pendientes',
        binding: { datasetId: 'casos', dimensions: [], measures: ['CasosIngresados', 'CasosPendientes'] },
      }),
      datos,
      ['suma', 'suma'],
    );

    expect(projected.rows).toEqual([['Ingresados vs pendientes', 650, 65]]);
  });

  it('un grafico de barras proyecta una fila por categoria, ya agregada', () => {
    const projected = projectObject(objectInstance({ objectId: 'barras' }), datos, ['suma']);

    expect(projected.columns.map((c) => c.name)).toEqual([
      'DimTribunal.Distrito',
      'CasosPendientes',
    ]);
    // Norte suma sus tres filas (10 + 5 + 20); el trimestre y la materia se agregaron.
    expect(projected.rows).toEqual([
      ['Norte', 35],
      ['Sur', 30],
    ]);
  });

  it('una tabla conserva una columna POR dimension, no la etiqueta compuesta', () => {
    const projected = projectObject(
      objectInstance({
        objectId: 'tabla',
        binding: {
          datasetId: 'casos',
          dimensions: [DISTRITO, MATERIA],
          measures: ['CasosPendientes'],
        },
      }),
      datos,
      ['suma', 'suma'],
    );

    expect(projected.columns.map((c) => c.name)).toEqual([
      'DimTribunal.Distrito',
      'DimTribunal.Materia',
      'CasosPendientes',
    ]);
    expect(projected.rows).toEqual([
      ['Norte', 'Penal', 15],
      ['Norte', 'Civil', 20],
      ['Sur', 'Penal', 30],
    ]);
  });

  it('una matriz proyecta el cruce con sus totales, como se ve en pantalla', () => {
    const projected = projectObject(
      objectInstance({
        objectId: 'matriz',
        binding: {
          datasetId: 'casos',
          dimensions: [DISTRITO, MATERIA],
          measures: ['CasosPendientes'],
        },
      }),
      datos,
      ['suma', 'suma'],
    );

    // La esquina nombra SOLO el eje de filas. Antes decia «Distrito / Materia» —los dos ejes en
    // el rotulo de uno—, que es exactamente lo que una matriz no es.
    expect(projected.columns.map((c) => c.name)).toEqual([
      'DimTribunal.Distrito',
      'Penal',
      'Civil',
      'Total',
    ]);
    expect(projected.rows).toEqual([
      ['Norte', 15, 20, 35],
      ['Sur', 30, null, 30],
      ['Total', 45, 20, 65],
    ]);
  });

  it('un segmentador proyecta sus opciones, que es lo unico que muestra', () => {
    const projected = projectObject(
      objectInstance({
        objectId: 'segmentador',
        binding: { datasetId: 'casos', dimensions: [MATERIA], measures: [] },
      }),
      datos,
      ['suma', 'suma'],
    );

    expect(projected.columns.map((c) => c.name)).toEqual(['DimTribunal.Materia']);
    expect(projected.rows).toEqual([['Civil'], ['Penal']]);
  });

  it('conserva la procedencia y la marca de tiempo del dato (4.8)', () => {
    const projected = projectObject(objectInstance({}), datos, ['suma']);
    expect(projected.source).toBe('mock');
    expect(projected.generatedAt).toBe('2026-03-01T10:00:00.000Z');
  });

  it('un campo que ya no existe no rompe la proyeccion: la deja en cero', () => {
    // 4.2 pide marcar roto, no fallar en silencio ni reventar. Marcarlo es cosa de
    // validateBinding; aqui lo que importa es que proyectar siga siendo posible.
    const projected = projectObject(
      objectInstance({ binding: { datasetId: 'casos', dimensions: [DISTRITO], measures: ['CampoRetirado'] } }),
      datos,
      ['suma', 'suma'],
    );
    expect(projected.rows).toEqual([
      ['Norte', 0],
      ['Sur', 0],
    ]);
  });
});

describe('breakdownOf', () => {
  it('devuelve las filas de origen de una categoria, con toda su granularidad', () => {
    const desglose = breakdownOf(datos, { 'DimTribunal.Distrito': 'Norte' });

    // Las tres filas de Norte, SIN agregar: es justo la granularidad que el objeto escondio.
    expect(desglose.rows).toHaveLength(3);
    expect(desglose.columns).toEqual(datos.columns);
  });

  it('cruza varias dimensiones para desglosar una celda concreta', () => {
    const desglose = breakdownOf(datos, {
      'DimTribunal.Distrito': 'Norte',
      'DimTribunal.Materia': 'Penal',
    });

    expect(desglose.rows).toEqual([
      ['Norte', 'Penal', 'Q1', 10, 100],
      ['Norte', 'Penal', 'Q2', 5, 50],
    ]);
  });

  it('sin seleccion devuelve el dataset completo: el alcance de objeto', () => {
    expect(breakdownOf(datos, {}).rows).toHaveLength(4);
  });

  it('una dimension que el dataset ya no expone se ignora y amplia, nunca estrecha', () => {
    // Ocultar filas por un cambio de esquema haria creer que no existen. Se prefiere un
    // desglose mas amplio y honesto: el dataset ya viene filtrado por el ambito de quien mira.
    const desglose = breakdownOf(datos, { 'DimTribunal.CampoRetirado': 'X' });
    expect(desglose.rows).toHaveLength(4);
  });
});

describe('los objetos que transforman antes de dibujar exportan lo TRANSFORMADO', () => {
  const CASO = { table: 'FactCasos', field: 'CasoId' };

  /** Grano atomico: una fila por caso, con sus dias. */
  const casos: QueryResult = {
    columns: [
      { name: 'FactCasos.CasoId', type: 'string' },
      { name: 'DimTribunal.Materia', type: 'string' },
      { name: 'DiasResolucion', type: 'number' },
    ],
    rows: [
      ['c1', 'Penal', 10],
      ['c2', 'Penal', 20],
      ['c3', 'Penal', 30],
      ['c4', 'Civil', 40],
    ],
    source: 'mock',
    generatedAt: '2026-03-01T10:00:00.000Z',
  };

  it('el histograma exporta INTERVALOS, no las observaciones', () => {
    /*
     * Es el mismo principio que la tarjeta KPI: volcar las filas del dataset seria exportar algo
     * que el objeto no muestra. Aqui pesa mas, porque el reparto en intervalos es justamente lo
     * que el objeto aporta.
     */
    const proyeccion = projectObject(
      objectInstance({
        objectId: 'histograma',
        binding: { datasetId: 'casos', dimensions: [CASO], measures: ['DiasResolucion'] },
        presentation: { histogram: { bins: 2 } },
      }),
      casos,
      ['ninguna'],
    );

    expect(proyeccion.columns.map((c) => c.name)).toEqual(['Intervalo', 'Observaciones']);
    expect(proyeccion.rows).toHaveLength(2);
    // Las cuatro observaciones repartidas, no las cuatro filas volcadas.
    expect(proyeccion.rows.reduce((suma, fila) => suma + Number(fila[1]), 0)).toBe(4);
  });

  it('y anade la columna de lo dibujado cuando acumula', () => {
    const proyeccion = projectObject(
      objectInstance({
        objectId: 'histograma',
        binding: { datasetId: 'casos', dimensions: [CASO], measures: ['DiasResolucion'] },
        presentation: { histogram: { bins: 2, cumulative: true } },
      }),
      casos,
      ['ninguna'],
    );

    expect(proyeccion.columns.map((c) => c.name)).toContain('Acumulado');
    expect(proyeccion.rows[proyeccion.rows.length - 1]?.[2]).toBe(4);
  });

  it('el diagrama de caja exporta los CINCO NUMEROS, uno por grupo', () => {
    const proyeccion = projectObject(
      objectInstance({
        objectId: 'diagrama-de-caja',
        binding: { datasetId: 'casos', dimensions: [MATERIA, CASO], measures: ['DiasResolucion'] },
      }),
      casos,
      ['ninguna'],
    );

    expect(proyeccion.columns.map((c) => c.name)).toEqual([
      'DimTribunal.Materia',
      'Minimo',
      'Q1',
      'Mediana',
      'Q3',
      'Maximo',
      'Atipicos',
      'Casos',
    ]);
    expect(proyeccion.rows).toHaveLength(2);
    expect(proyeccion.rows[0]).toEqual(['Penal', 10, 15, 20, 25, 30, 0, 3]);
  });

  it('el mapa de calor exporta la REJILLA, con una columna por cruce', () => {
    const proyeccion = projectObject(
      objectInstance({
        objectId: 'mapa-de-calor',
        binding: {
          datasetId: 'casos',
          dimensions: [MATERIA, { table: 'DimTiempo', field: 'Trimestre' }],
          measures: ['CasosPendientes'],
        },
      }),
      datos,
      ['suma'],
    );

    expect(proyeccion.columns.map((c) => c.name)).toEqual(['DimTribunal.Materia', 'Q1', 'Q2']);
    // Un cruce que no existe viaja como null, no como cero: en una hoja, un cero es un dato.
    expect(proyeccion.rows).toEqual([
      ['Penal', 40, 5],
      ['Civil', 20, null],
    ]);
  });

  it('el diagrama de flujo exporta TAMBIEN lo que el lienzo no traza', () => {
    /*
     * Un ciclo es parte del proceso; lo unico que le pasa es que no se puede trazar. Dejarlo fuera
     * de la exportacion convertiria una limitacion del dibujo en un dato que desaparece.
     */
    const conCiclo: QueryResult = {
      columns: [
        { name: 'Proceso.Origen', type: 'string' },
        { name: 'Proceso.Destino', type: 'string' },
        { name: 'Casos', type: 'number' },
      ],
      rows: [
        ['Primera', 'Apelacion', 40],
        ['Apelacion', 'Primera', 10],
      ],
      source: 'mock',
      generatedAt: '2026-03-01T10:00:00.000Z',
    };

    const proyeccion = projectObject(
      objectInstance({
        objectId: 'diagrama-de-flujo',
        binding: {
          datasetId: 'casos',
          dimensions: [
            { table: 'Proceso', field: 'Origen' },
            { table: 'Proceso', field: 'Destino' },
          ],
          measures: ['Casos'],
        },
      }),
      conCiclo,
      ['suma'],
    );

    expect(proyeccion.rows).toHaveLength(2);
    expect(proyeccion.rows[1]).toEqual(['Apelacion', 'Primera', 10, 'ciclo']);
  });
});
