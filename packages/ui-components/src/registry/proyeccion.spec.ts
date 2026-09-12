import type { QueryResult } from '@app/data-contracts';
import { describe, expect, it } from 'vitest';
import { desgloseDe, proyectarObjeto } from './proyeccion';
import type { ObjectInstance } from './types';

/**
 * Lo que se vigila aqui es que lo proyectado sea LO QUE EL OBJETO MUESTRA.
 *
 * Antes de existir esta funcion, la exportacion volcaba el dataset entero bajo el titulo de cada
 * objeto: una tarjeta KPI que muestra un numero exportaba las filas completas, y cinco objetos
 * sobre el mismo dataset producian cinco veces la misma tabla.
 */

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

const instancia = (parcial: Partial<ObjectInstance>): ObjectInstance => ({
  instanceId: 'i1',
  objectId: 'barras',
  version: '1.0.0',
  binding: { datasetId: 'casos', dimensions: [DISTRITO], measures: ['CasosPendientes'] },
  ...parcial,
});

describe('proyectarObjeto', () => {
  it('una tarjeta KPI proyecta UNA fila, no las filas del dataset', () => {
    const proyectado = proyectarObjeto(
      instancia({
        objectId: 'tarjeta-kpi',
        title: 'Casos pendientes',
        binding: { datasetId: 'casos', dimensions: [], measures: ['CasosPendientes'] },
      }),
      datos,
      ['suma', 'suma'],
    );

    expect(proyectado.columns.map((c) => c.name)).toEqual(['Indicador', 'CasosPendientes']);
    expect(proyectado.rows).toEqual([['Casos pendientes', 65]]);
  });

  it('una tarjeta con comparacion proyecta las dos medidas', () => {
    const proyectado = proyectarObjeto(
      instancia({
        objectId: 'tarjeta-kpi',
        title: 'Ingresados vs pendientes',
        binding: { datasetId: 'casos', dimensions: [], measures: ['CasosIngresados', 'CasosPendientes'] },
      }),
      datos,
      ['suma', 'suma'],
    );

    expect(proyectado.rows).toEqual([['Ingresados vs pendientes', 650, 65]]);
  });

  it('un grafico de barras proyecta una fila por categoria, ya agregada', () => {
    const proyectado = proyectarObjeto(instancia({ objectId: 'barras' }), datos, ['suma']);

    expect(proyectado.columns.map((c) => c.name)).toEqual([
      'DimTribunal.Distrito',
      'CasosPendientes',
    ]);
    // Norte suma sus tres filas (10 + 5 + 20); el trimestre y la materia se agregaron.
    expect(proyectado.rows).toEqual([
      ['Norte', 35],
      ['Sur', 30],
    ]);
  });

  it('una tabla conserva una columna POR dimension, no la etiqueta compuesta', () => {
    const proyectado = proyectarObjeto(
      instancia({
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

    expect(proyectado.columns.map((c) => c.name)).toEqual([
      'DimTribunal.Distrito',
      'DimTribunal.Materia',
      'CasosPendientes',
    ]);
    expect(proyectado.rows).toEqual([
      ['Norte', 'Penal', 15],
      ['Norte', 'Civil', 20],
      ['Sur', 'Penal', 30],
    ]);
  });

  it('una matriz proyecta el cruce con sus totales, como se ve en pantalla', () => {
    const proyectado = proyectarObjeto(
      instancia({
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

    expect(proyectado.columns.map((c) => c.name)).toEqual([
      'DimTribunal.Distrito / DimTribunal.Materia',
      'Penal',
      'Civil',
      'Total',
    ]);
    expect(proyectado.rows).toEqual([
      ['Norte', 15, 20, 35],
      ['Sur', 30, null, 30],
      ['Total', 45, 20, 65],
    ]);
  });

  it('un segmentador proyecta sus opciones, que es lo unico que muestra', () => {
    const proyectado = proyectarObjeto(
      instancia({
        objectId: 'segmentador',
        binding: { datasetId: 'casos', dimensions: [MATERIA], measures: [] },
      }),
      datos,
      ['suma', 'suma'],
    );

    expect(proyectado.columns.map((c) => c.name)).toEqual(['DimTribunal.Materia']);
    expect(proyectado.rows).toEqual([['Civil'], ['Penal']]);
  });

  it('conserva la procedencia y la marca de tiempo del dato (4.8)', () => {
    const proyectado = proyectarObjeto(instancia({}), datos, ['suma']);
    expect(proyectado.source).toBe('mock');
    expect(proyectado.generatedAt).toBe('2026-03-01T10:00:00.000Z');
  });

  it('un campo que ya no existe no rompe la proyeccion: la deja en cero', () => {
    // 4.2 pide marcar roto, no fallar en silencio ni reventar. Marcarlo es cosa de
    // validateBinding; aqui lo que importa es que proyectar siga siendo posible.
    const proyectado = proyectarObjeto(
      instancia({ binding: { datasetId: 'casos', dimensions: [DISTRITO], measures: ['CampoRetirado'] } }),
      datos,
      ['suma', 'suma'],
    );
    expect(proyectado.rows).toEqual([
      ['Norte', 0],
      ['Sur', 0],
    ]);
  });
});

describe('desgloseDe', () => {
  it('devuelve las filas de origen de una categoria, con toda su granularidad', () => {
    const desglose = desgloseDe(datos, { 'DimTribunal.Distrito': 'Norte' });

    // Las tres filas de Norte, SIN agregar: es justo la granularidad que el objeto escondio.
    expect(desglose.rows).toHaveLength(3);
    expect(desglose.columns).toEqual(datos.columns);
  });

  it('cruza varias dimensiones para desglosar una celda concreta', () => {
    const desglose = desgloseDe(datos, {
      'DimTribunal.Distrito': 'Norte',
      'DimTribunal.Materia': 'Penal',
    });

    expect(desglose.rows).toEqual([
      ['Norte', 'Penal', 'Q1', 10, 100],
      ['Norte', 'Penal', 'Q2', 5, 50],
    ]);
  });

  it('sin seleccion devuelve el dataset completo: el alcance de objeto', () => {
    expect(desgloseDe(datos, {}).rows).toHaveLength(4);
  });

  it('una dimension que el dataset ya no expone se ignora y amplia, nunca estrecha', () => {
    // Ocultar filas por un cambio de esquema haria creer que no existen. Se prefiere un
    // desglose mas amplio y honesto: el dataset ya viene filtrado por el ambito de quien mira.
    const desglose = desgloseDe(datos, { 'DimTribunal.CampoRetirado': 'X' });
    expect(desglose.rows).toHaveLength(4);
  });
});
