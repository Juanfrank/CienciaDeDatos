import { describe, expect, it } from 'vitest';
import type { QueryResult } from '@app/data-contracts';
import { construirMatriz, filasVisibles, hojas, rutaClave } from './matriz';

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };
const MATERIA = { table: 'DimTribunal', field: 'Materia' };
const TRIMESTRE = { table: 'DimTiempo', field: 'Trimestre' };

/** Grupos de tamano DESIGUAL a proposito: es donde un subtotal mal calculado se nota. */
const datos: QueryResult = {
  columns: [
    { name: 'DimTribunal.Distrito', type: 'string' },
    { name: 'DimTribunal.Materia', type: 'string' },
    { name: 'DimTiempo.Trimestre', type: 'string' },
    { name: 'Dias', type: 'number' },
  ],
  rows: [
    ['Norte', 'Penal', 'Q1', 100],
    ['Norte', 'Penal', 'Q1', 200],
    ['Norte', 'Penal', 'Q2', 300],
    ['Norte', 'Civil', 'Q1', 60],
    ['Sur', 'Penal', 'Q1', 40],
  ],
  source: 'mock',
  generatedAt: '2026-09-12T00:00:00.000Z',
};

const matriz = (aggregation: 'suma' | 'promedio') =>
  construirMatriz(datos, [DISTRITO, MATERIA], [TRIMESTRE], ['Dias'], [aggregation]);

describe('la jerarquia', () => {
  it('anida las filas en el orden en que se mapean', () => {
    const m = matriz('suma');
    expect(m.filas.map((f) => f.etiqueta)).toEqual(['Norte', 'Sur']);
    expect(m.filas[0]?.hijos.map((h) => h.etiqueta)).toEqual(['Penal', 'Civil']);
    expect(m.filas[0]?.hijos[0]?.ruta).toEqual(['Norte', 'Penal']);
  });

  it('las columnas tambien forman arbol, y sus hojas son las que llevan cifras', () => {
    const m = matriz('suma');
    expect(hojas(m.columnas, new Set()).map((c) => c.etiqueta)).toEqual(['Q1', 'Q2']);
  });
});

describe('los subtotales salen de las filas de ORIGEN', () => {
  it('un nivel intermedio suma lo suyo, no lo de sus hijos ya sumado', () => {
    const m = matriz('suma');
    expect(m.valor(['Norte', 'Penal'], ['Q1'], 0)).toBe(300);
    expect(m.valor(['Norte', 'Penal'], [], 0)).toBe(600);
    expect(m.valor(['Norte'], [], 0)).toBe(660);
    expect(m.valor([], [], 0)).toBe(700);
  });

  it('con promedio, el subtotal NO es el promedio de los promedios de sus hijos', () => {
    /*
     * Es la prueba que importa. Norte/Penal promedia 200 sobre tres casos y Norte/Civil promedia
     * 60 sobre uno. El promedio de esos dos promedios da 130; el real, sobre los cuatro casos,
     * es 165. Solo coincidirian si los dos grupos pesaran igual, y aqui no pesan igual.
     */
    const m = matriz('promedio');
    expect(m.valor(['Norte', 'Penal'], [], 0)).toBe(200);
    expect(m.valor(['Norte', 'Civil'], [], 0)).toBe(60);
    expect(m.valor(['Norte'], [], 0)).toBe(165);
    expect(m.valor(['Norte'], [], 0)).not.toBe(130);
  });

  it('una combinacion sin filas de origen es null, no cero', () => {
    const m = matriz('suma');
    expect(m.valor(['Sur'], ['Q2'], 0)).toBeNull();
  });
});

describe('plegar', () => {
  it('un nodo plegado se ve, y sus descendientes no', () => {
    const m = matriz('suma');
    // «Penal» aparece dos veces y son nodos DISTINTOS: uno cuelga de Norte y otro de Sur. Por eso
    // nada puede identificarse por su etiqueta —ni una clave de React ni un `data-testid`—: la
    // ruta completa es lo unico unico.
    expect(filasVisibles(m.filas, new Set()).map((f) => rutaClave(f.ruta))).toEqual([
      'Norte',
      'Norte||Penal',
      'Norte||Civil',
      'Sur',
      'Sur||Penal',
    ]);
    const plegado = new Set([rutaClave(['Norte'])]);
    expect(filasVisibles(m.filas, plegado).map((f) => rutaClave(f.ruta))).toEqual([
      'Norte',
      'Sur',
      'Sur||Penal',
    ]);
  });

  it('una columna plegada pasa a ser hoja: ensena su subtotal en vez de su detalle', () => {
    const m = construirMatriz(datos, [DISTRITO], [MATERIA, TRIMESTRE], ['Dias'], ['suma']);
    expect(hojas(m.columnas, new Set()).map((c) => rutaClave(c.ruta))).toEqual([
      'Penal||Q1',
      'Penal||Q2',
      'Civil||Q1',
    ]);
    const plegada = new Set(['Penal']);
    expect(hojas(m.columnas, plegada).map((c) => rutaClave(c.ruta))).toEqual(['Penal', 'Civil||Q1']);
  });
});
