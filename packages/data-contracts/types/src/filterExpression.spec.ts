import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  filterIsEmpty,
  parseFilters,
  splitFilterKey,
  valueMatches,
} from './filterExpression';
import type { FieldFilter, QueryResult } from './index';

/**
 * Como se expresa un filtro, de la URL al dato.
 *
 * Lo que se fija aqui es lo que no se ve en pantalla: que «contiene» no distinga acentos, que un
 * rango sobre numeros ordene como numeros y no como texto, y que lo que no es un filtro —la
 * pagina abierta, el cromo del marco— no se convierta en uno.
 */

const filtro = (parcial: Partial<FieldFilter> & { field: string }): FieldFilter => ({
  incluye: [],
  excluye: [],
  ...parcial,
});

describe('splitFilterKey', () => {
  it('separa el sufijo solo cuando es uno de los que existen', () => {
    expect(splitFilterKey('DimTiempo.Anio.desde')).toEqual({
      field: 'DimTiempo.Anio',
      suffix: 'desde',
    });
    // Una clave de campo lleva un punto por naturaleza: sin esta regla, `DimTiempo.Trimestre`
    // pasaria por un filtro sobre `DimTiempo` con sufijo «Trimestre».
    expect(splitFilterKey('DimTiempo.Trimestre')).toEqual({ field: 'DimTiempo.Trimestre' });
    expect(splitFilterKey('pagina')).toEqual({ field: 'pagina' });
  });
});

describe('filterIsEmpty', () => {
  it('distingue «no se pidio nada» de «se pidio el conjunto vacio»', () => {
    // No es lo mismo: sin nada pedido el filtro no quita ninguna fila, y `applyFilters` lo
    // descarta en vez de recorrer el resultado entero para no quitar nada.
    expect(filterIsEmpty(filtro({ field: 'x' }))).toBe(true);
    expect(filterIsEmpty(filtro({ field: 'x', incluye: ['a'] }))).toBe(false);
    expect(filterIsEmpty(filtro({ field: 'x', vacio: false }))).toBe(false);
  });
});

describe('parseFilters', () => {
  it('sin sufijo es «pertenece a», como se venia escribiendo', () => {
    // Es lo que ya escriben el filtrado cruzado, los marcadores, el drill-through y la
    // exportacion: cambiarlo habria roto todas las direcciones guardadas.
    expect(parseFilters({ 'DimTribunal.Distrito': ['Norte', 'Este'] })).toEqual([
      filtro({ field: 'DimTribunal.Distrito', incluye: ['Norte', 'Este'] }),
    ]);
  });

  it('junta en UN filtro todo lo que se pide sobre el mismo campo', () => {
    const leidos = parseFilters({
      'DimTribunal.Nombre': 'Camara Civil',
      'DimTribunal.Nombre.contiene': 'civil',
      'DimTribunal.Nombre.no': 'Camara Penal',
    });

    expect(leidos).toEqual([
      filtro({
        field: 'DimTribunal.Nombre',
        incluye: ['Camara Civil'],
        excluye: ['Camara Penal'],
        contiene: 'civil',
      }),
    ]);
  });

  it('lo que no es un filtro no se convierte en uno', () => {
    // En la misma query viajan la pagina abierta, el cromo del marco y el estado de los
    // complementos. Solo se reconocen sufijos conocidos; el resto es una clave de campo, y si no
    // existe como columna, `applyFilters` la ignora.
    expect(parseFilters({ cromo: 'limpio', pagina: 'graficos' })).toEqual([
      filtro({ field: 'cromo', incluye: ['limpio'] }),
      filtro({ field: 'pagina', incluye: ['graficos'] }),
    ]);
  });

  it('descarta lo vacio: un campo de texto que se borro no filtra', () => {
    expect(parseFilters({ 'DimTribunal.Nombre.contiene': '' })).toEqual([]);
    expect(parseFilters({ 'DimTribunal.Distrito': [''] })).toEqual([]);
  });

  it('«vacio» solo entiende si y no', () => {
    expect(parseFilters({ 'X.vacio': 'si' })[0]?.vacio).toBe(true);
    expect(parseFilters({ 'X.vacio': 'no' })[0]?.vacio).toBe(false);
    expect(parseFilters({ 'X.vacio': 'quiza' })).toEqual([]);
  });
});

describe('valueMatches', () => {
  it('pertenece a, y no pertenece a', () => {
    const f = filtro({ field: 'x', incluye: ['a', 'b'], excluye: ['b'] });
    expect(valueMatches(f, 'a')).toBe(true);
    // Excluir gana sobre incluir: pedir las dos cosas sobre el mismo valor no deja nada, que es
    // literalmente lo que se pidio.
    expect(valueMatches(f, 'b')).toBe(false);
    expect(valueMatches(f, 'c')).toBe(false);
  });

  it('«contiene» y «empieza» no distinguen mayusculas ni acentos', () => {
    /*
     * «Peña» y «Pena» se escriben de las dos maneras en los expedientes y quien busca no sabe
     * cual quedo registrada. Distinguiendo acentos, la busqueda devuelve cero y parece que no hay
     * datos.
     */
    expect(valueMatches(filtro({ field: 'x', contiene: 'pena' }), 'Cámara Peña')).toBe(true);
    expect(valueMatches(filtro({ field: 'x', empieza: 'cam' }), 'Cámara Civil')).toBe(true);
    expect(valueMatches(filtro({ field: 'x', empieza: 'civil' }), 'Cámara Civil')).toBe(false);
  });

  it('un rango sobre numeros ordena como numeros, no como texto', () => {
    // Como texto, «10» va antes que «9» y un «desde 9» se dejaria fuera el 10.
    const f = filtro({ field: 'x', desde: '9' });
    expect(valueMatches(f, 10)).toBe(true);
    expect(valueMatches(f, 8)).toBe(false);
  });

  it('un rango sobre fechas ISO ordena como texto, que es lo correcto', () => {
    const f = filtro({ field: 'x', desde: '2026-01-01', hasta: '2026-06-30' });
    expect(valueMatches(f, '2026-03-15')).toBe(true);
    expect(valueMatches(f, '2025-12-31')).toBe(false);
    expect(valueMatches(f, '2026-07-01')).toBe(false);
  });

  it('los extremos del rango entran', () => {
    const f = filtro({ field: 'x', desde: '2026-01-01', hasta: '2026-06-30' });
    expect(valueMatches(f, '2026-01-01')).toBe(true);
    expect(valueMatches(f, '2026-06-30')).toBe(true);
  });

  it('una celda vacia no entra en ningun rango', () => {
    // No es que valga cero: es que no dice nada, y colarla en «hasta 2024» seria afirmar algo que
    // el expediente no dice.
    expect(valueMatches(filtro({ field: 'x', hasta: '2026' }), null)).toBe(false);
    expect(valueMatches(filtro({ field: 'x', desde: '0' }), '')).toBe(false);
  });

  it('«vacio» distingue lo que no tiene valor de lo que tiene uno vacio', () => {
    expect(valueMatches(filtro({ field: 'x', vacio: true }), null)).toBe(true);
    expect(valueMatches(filtro({ field: 'x', vacio: true }), '   ')).toBe(true);
    expect(valueMatches(filtro({ field: 'x', vacio: true }), 'algo')).toBe(false);
    expect(valueMatches(filtro({ field: 'x', vacio: false }), 'algo')).toBe(true);
    expect(valueMatches(filtro({ field: 'x', vacio: false }), null)).toBe(false);
  });

  it('todo lo que el filtro pide se cumple a la vez', () => {
    const f = filtro({ field: 'x', contiene: 'camara', excluye: ['Camara Penal'] });
    expect(valueMatches(f, 'Camara Civil')).toBe(true);
    expect(valueMatches(f, 'Camara Penal')).toBe(false);
    expect(valueMatches(f, 'Juzgado de Paz')).toBe(false);
  });
});

describe('applyFilters', () => {
  const result: QueryResult = {
    columns: [
      { name: 'DimTribunal.Nombre', type: 'string' },
      { name: 'DimTiempo.Anio', type: 'number' },
      { name: 'CasosPendientes', type: 'number' },
    ],
    rows: [
      ['Camara Civil', 2024, 10],
      ['Camara Penal', 2025, 20],
      ['Juzgado de Paz', 2026, 30],
    ],
    source: 'mock',
    generatedAt: '2026-09-14T00:00:00.000Z',
  };

  it('sin filtros devuelve el MISMO resultado, no una copia', () => {
    // Copiarlo por costumbre romperia la identidad de la que dependen las memorizaciones de
    // React rio abajo: cada lectura pareceria un dato nuevo y volveria a dibujarlo todo.
    expect(applyFilters(result, [])).toBe(result);
  });

  it('un filtro sobre una columna que el resultado no trae se IGNORA', () => {
    /*
     * Vaciarlo diria «no hay datos» cuando lo que pasa es que la direccion menciona un campo que
     * este objeto no ensena. En una pagina cada objeto trae sus propias columnas, asi que un
     * filtro de otro objeto pasaria por aqui en cada lectura.
     */
    const salida = applyFilters(result, [filtro({ field: 'NoExiste', incluye: ['x'] })]);
    expect(salida.rows).toHaveLength(3);
  });

  it('acota por texto y por rango numerico a la vez', () => {
    const salida = applyFilters(result, [
      filtro({ field: 'DimTribunal.Nombre', contiene: 'camara' }),
      filtro({ field: 'DimTiempo.Anio', desde: '2025' }),
    ]);

    expect(salida.rows).toEqual([['Camara Penal', 2025, 20]]);
    // Y conserva la procedencia: filtrar no cambia de donde vino el dato ni cuando se calculo.
    expect(salida.source).toBe(result.source);
    expect(salida.generatedAt).toBe(result.generatedAt);
  });
});
