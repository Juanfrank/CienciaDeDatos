import { describe, expect, it } from 'vitest';
import type { QueryResult } from '@app/data-contracts';
import type { ObjectInstance } from './types';
import {
  toCategorical,
  toKpi,
  toMatrix,
  toSlicerOptions,
  validateBinding,
} from './viewModel';

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };
const MATERIA = { table: 'DimTribunal', field: 'Materia' };

const resultado: QueryResult = {
  columns: [
    { name: 'DimTribunal.Distrito', type: 'string' },
    { name: 'DimTribunal.Materia', type: 'string' },
    { name: 'CasosPendientes', type: 'number' },
    { name: 'CasosResueltos', type: 'number' },
  ],
  rows: [
    ['Norte', 'Penal', 10, 5],
    ['Norte', 'Civil', 20, 8],
    ['Este', 'Penal', 30, 12],
  ],
  source: 'mock',
  generatedAt: '2026-09-11T08:00:00.000Z',
};

describe('validateBinding (4.2)', () => {
  const instancia = (dimensions: typeof resultado.columns extends never ? never : { table: string; field: string }[], measures: string[]): ObjectInstance => ({
    instanceId: 'i1',
    objectId: 'barras',
    version: '1.0.0',
    binding: { datasetId: 'casos', dimensions, measures },
  });

  const contrato = { dimensions: { min: 1, max: 1 }, measures: { min: 1, max: 1 } };
  const columnas = resultado.columns.map((c) => c.name);

  it('un mapeo correcto no reporta problemas', () => {
    expect(validateBinding(instancia([DISTRITO], ['CasosPendientes']), contrato, columnas)).toEqual([]);
  });

  it('marca roto un campo que ya no existe, en vez de fallar en silencio', () => {
    const problems = validateBinding(
      instancia([{ table: 'DimTribunal', field: 'CampoBorrado' }], ['CasosPendientes']),
      contrato,
      columnas,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      slot: 'DimTribunal.CampoBorrado',
      kind: 'campo-inexistente',
    });
  });

  it('marca rota una medida que ya no existe', () => {
    const problems = validateBinding(
      instancia([DISTRITO], ['MedidaBorrada']),
      contrato,
      columnas,
    );
    expect(problems[0]?.kind).toBe('campo-inexistente');
  });

  it('distingue el incumplimiento de contrato del campo inexistente', () => {
    const problems = validateBinding(
      instancia([DISTRITO, MATERIA], ['CasosPendientes']),
      contrato,
      columnas,
    );
    expect(problems[0]?.kind).toBe('contrato-incumplido');
    expect(problems[0]?.problem).toMatch(/admite entre 1 y 1 dimensiones/);
  });

  it('devuelve TODOS los problemas, para poder señalarlos de una vez en el editor', () => {
    const problems = validateBinding(
      instancia([{ table: 'X', field: 'Y' }, MATERIA], ['Inexistente']),
      contrato,
      columnas,
    );
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });
});

describe('toCategorical', () => {
  it('proyecta una serie por medida sobre las categorias de la dimension', () => {
    const vm = toCategorical(resultado, [DISTRITO], ['CasosPendientes'], ['suma']);
    expect(vm.series).toEqual(['CasosPendientes']);
    expect(vm.points).toEqual([
      { label: 'Norte', values: [30] },
      { label: 'Este', values: [30] },
    ]);
  });

  it('agrega sobre el dataset ya cacheado cuando trae mas granularidad (6.6)', () => {
    // El dataset tiene distrito x materia; el objeto solo muestra distrito.
    const vm = toCategorical(resultado, [DISTRITO], ['CasosPendientes'], ['suma']);
    expect(vm.aggregated).toBe(true);
  });

  it('no marca agregacion si cada categoria tiene una sola fila', () => {
    const vm = toCategorical(resultado, [DISTRITO, MATERIA], ['CasosPendientes'], ['suma']);
    expect(vm.aggregated).toBe(false);
    expect(vm.points).toHaveLength(3);
  });

  it('compone la etiqueta cuando hay varias dimensiones', () => {
    const vm = toCategorical(resultado, [DISTRITO, MATERIA], ['CasosPendientes'], ['suma']);
    expect(vm.points[0]?.label).toBe('Norte / Penal');
  });

  it('admite varias medidas como series paralelas', () => {
    const vm = toCategorical(resultado, [DISTRITO], ['CasosPendientes', 'CasosResueltos'], ['suma', 'suma']);
    expect(vm.points[0]).toEqual({ label: 'Norte', values: [30, 13] });
  });

  it('una columna ausente da cero, no rompe el grafico', () => {
    const vm = toCategorical(resultado, [DISTRITO], ['NoExiste'], ['suma']);
    expect(vm.points[0]?.values).toEqual([0]);
  });
});

describe('toKpi', () => {
  it('suma la medida sobre las filas visibles', () => {
    expect(toKpi(resultado, ['CasosPendientes'], 'Pendientes', ['suma'])).toEqual({
      value: 60,
      label: 'Pendientes',
    });
  });

  it('calcula la variacion contra la medida de comparacion', () => {
    const kpi = toKpi(resultado, ['CasosPendientes', 'CasosResueltos'], 'Pendientes', ['suma', 'suma']);
    expect(kpi.delta?.absolute).toBe(35);
    expect(kpi.delta?.relative).toBeCloseTo(35 / 25, 5);
  });

  it('una base de cero da variacion nula, no infinito', () => {
    const cero: QueryResult = {
      ...resultado,
      rows: [['Norte', 'Penal', 10, 0]],
    };
    const kpi = toKpi(cero, ['CasosPendientes', 'CasosResueltos'], 'x', ['suma', 'suma']);
    expect(kpi.delta?.relative).toBeNull();
  });

  it('sin filas el valor es cero, no NaN', () => {
    expect(toKpi({ ...resultado, rows: [] }, ['CasosPendientes'], 'x', ['suma']).value).toBe(0);
  });
});

describe('toMatrix', () => {
  it('cruza dos dimensiones con totales por fila, columna y general', () => {
    const m = toMatrix(resultado, [DISTRITO, MATERIA], 'CasosPendientes', 'suma');
    expect(m.rowLabels).toEqual(['Norte', 'Este']);
    expect(m.columnLabels).toEqual(['Penal', 'Civil']);
    expect(m.cells).toEqual([
      [10, 20],
      [30, null],
    ]);
    expect(m.rowTotals).toEqual([30, 30]);
    expect(m.columnTotals).toEqual([40, 20]);
    expect(m.grandTotal).toBe(60);
  });

  it('una combinacion sin filas queda nula, distinguible de un cero real', () => {
    const m = toMatrix(resultado, [DISTRITO, MATERIA], 'CasosPendientes', 'suma');
    expect(m.cells[1]?.[1]).toBeNull();
  });
});

describe('toSlicerOptions', () => {
  it('devuelve los valores distintos de la dimension, ordenados', () => {
    expect(toSlicerOptions(resultado, DISTRITO)).toEqual(['Este', 'Norte']);
  });

  it('una dimension ausente da lista vacia, no rompe el segmentador', () => {
    expect(toSlicerOptions(resultado, { table: 'X', field: 'Y' })).toEqual([]);
  });

  it('solo ofrece los valores presentes en el dataset ya filtrado por el ambito', () => {
    // Consecuencia de seguridad: el segmentador no puede revelar valores fuera del ambito,
    // porque solo ve las filas que sobrevivieron al filtrado (4.11).
    const soloNorte: QueryResult = { ...resultado, rows: [['Norte', 'Penal', 10, 5]] };
    expect(toSlicerOptions(soloNorte, DISTRITO)).toEqual(['Norte']);
  });
});
