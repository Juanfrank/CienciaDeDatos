import { describe, expect, it } from 'vitest';
import type { QueryResult } from '@app/data-contracts';
import { DIM_DISTRITO, DIM_MATERIA, scope } from './__fixtures__/governance';
import {
  UNRESTRICTED_SCOPE,
  assertScopeIsEnforceable,
  deniesEverything,
  filterResultByScope,
  intersect,
  intersectRequestedFilters,
  scopeToFilters,
  wouldExpand,
} from './AccessScope';

describe('intersect', () => {
  it('dimension en ambos: interseca los valores permitidos', () => {
    const a = scope(DIM_DISTRITO, 'Norte', 'Este', 'Sur');
    const b = scope(DIM_DISTRITO, 'Este', 'Sur', 'Nacional');
    expect(scopeToFilters(intersect(a, b))).toEqual({ 'DimTribunal.Distrito': ['Este', 'Sur'] });
  });

  it('dimension en solo uno: se incorpora tal cual, porque añadirla restringe', () => {
    const a = scope(DIM_DISTRITO, 'Norte');
    const b = scope(DIM_MATERIA, 'Penal');
    expect(scopeToFilters(intersect(a, b))).toEqual({
      'DimTribunal.Distrito': ['Norte'],
      'DimTribunal.Materia': ['Penal'],
    });
  });

  it('interseccion vacia: el ambito no permite nada', () => {
    const r = intersect(scope(DIM_DISTRITO, 'Norte'), scope(DIM_DISTRITO, 'Este'));
    expect(deniesEverything(r)).toBe(true);
  });

  it('un ambito sin restricciones es el elemento neutro', () => {
    const a = scope(DIM_DISTRITO, 'Norte');
    expect(scopeToFilters(intersect(a, UNRESTRICTED_SCOPE))).toEqual(scopeToFilters(a));
    expect(scopeToFilters(intersect(UNRESTRICTED_SCOPE, a))).toEqual(scopeToFilters(a));
  });

  it('es conmutativa en lo que permite', () => {
    const a = scope(DIM_DISTRITO, 'Norte', 'Este');
    const b = scope(DIM_DISTRITO, 'Este', 'Sur');
    expect(scopeToFilters(intersect(a, b))).toEqual(scopeToFilters(intersect(b, a)));
  });

  it('nunca permite mas que cualquiera de sus operandos', () => {
    const a = scope(DIM_DISTRITO, 'Norte', 'Este');
    const b = scope(DIM_DISTRITO, 'Este', 'Sur');
    const permitidos = scopeToFilters(intersect(a, b))['DimTribunal.Distrito'] ?? [];
    const permitidosDeA = scopeToFilters(a)['DimTribunal.Distrito'] ?? [];
    const permitidosDeB = scopeToFilters(b)['DimTribunal.Distrito'] ?? [];
    expect(permitidos.every((v) => permitidosDeA.includes(v))).toBe(true);
    expect(permitidos.every((v) => permitidosDeB.includes(v))).toBe(true);
  });
});

describe('wouldExpand — deteccion de ampliacion antes de guardar (4.10.8)', () => {
  it('detecta que omitir una dimension restringida ampliaria', () => {
    expect(wouldExpand(scope(DIM_DISTRITO, 'Norte'), UNRESTRICTED_SCOPE)).toBe(true);
  });

  it('detecta que añadir un valor no permitido ampliaria', () => {
    expect(wouldExpand(scope(DIM_DISTRITO, 'Norte'), scope(DIM_DISTRITO, 'Norte', 'Este'))).toBe(true);
  });

  it('restringir a un subconjunto no amplia', () => {
    expect(wouldExpand(scope(DIM_DISTRITO, 'Norte', 'Este'), scope(DIM_DISTRITO, 'Norte'))).toBe(false);
  });

  it('restringir una dimension nueva no amplia', () => {
    expect(wouldExpand(UNRESTRICTED_SCOPE, scope(DIM_MATERIA, 'Penal'))).toBe(false);
  });
});

describe('intersectRequestedFilters — parametros de URL (4.11)', () => {
  const ambito = scope(DIM_DISTRITO, 'Norte', 'Este');

  it('un parametro puede restringir dentro de lo permitido', () => {
    expect(intersectRequestedFilters(ambito, { 'DimTribunal.Distrito': 'Norte' })).toEqual({
      'DimTribunal.Distrito': ['Norte'],
    });
  });

  it('un parametro fuera del ambito no amplia: se aplica solo la parte permitida', () => {
    expect(
      intersectRequestedFilters(ambito, { 'DimTribunal.Distrito': ['Norte', 'Nacional'] }),
    ).toEqual({ 'DimTribunal.Distrito': ['Norte'] });
  });

  it('un parametro completamente fuera del ambito deja el resultado vacio, sin revelar nada', () => {
    expect(intersectRequestedFilters(ambito, { 'DimTribunal.Distrito': 'Nacional' })).toEqual({
      'DimTribunal.Distrito': [],
    });
  });

  it('un parametro sobre una dimension no restringida se aplica como filtro normal', () => {
    expect(intersectRequestedFilters(ambito, { 'DimTribunal.Materia': 'Penal' })).toEqual({
      'DimTribunal.Distrito': ['Norte', 'Este'],
      'DimTribunal.Materia': ['Penal'],
    });
  });

  it('un enlace compartido se filtra segun quien lo abre, no segun quien lo genero', () => {
    // La URL la genero alguien del Norte, filtrada a su ambito.
    const urlTheParameters = { 'DimTribunal.Distrito': 'Norte' };
    // La abre alguien cuyo ambito es solo Este.
    const opensWhoScope = scope(DIM_DISTRITO, 'Este');
    expect(intersectRequestedFilters(opensWhoScope, urlTheParameters)).toEqual({
      'DimTribunal.Distrito': [],
    });
  });
});

describe('filterResultByScope', () => {
  const resultado: QueryResult = {
    columns: [
      { name: 'DimTribunal.Distrito', type: 'string' },
      { name: 'CasosPendientes', type: 'number' },
    ],
    rows: [
      ['Norte', 10],
      ['Este', 20],
      ['Sur', 30],
    ],
    source: 'mock',
    generatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('filtra las filas del dataset cacheado segun el ambito', () => {
    const r = filterResultByScope(resultado, scope(DIM_DISTRITO, 'Norte', 'Sur'));
    expect(r.rows).toEqual([
      ['Norte', 10],
      ['Sur', 30],
    ]);
  });

  it('un ambito sin restricciones devuelve todo', () => {
    expect(filterResultByScope(resultado, UNRESTRICTED_SCOPE).rows).toHaveLength(3);
  });

  it('un ambito que no permite nada devuelve cero filas', () => {
    expect(filterResultByScope(resultado, scope(DIM_DISTRITO)).rows).toHaveLength(0);
  });

  it('dos ambitos distintos sobre el MISMO dataset producen subconjuntos distintos', () => {
    const norte = filterResultByScope(resultado, scope(DIM_DISTRITO, 'Norte'));
    const este = filterResultByScope(resultado, scope(DIM_DISTRITO, 'Este'));
    expect(norte.rows).toEqual([['Norte', 10]]);
    expect(este.rows).toEqual([['Este', 20]]);
  });

  it('no muta el resultado original', () => {
    filterResultByScope(resultado, scope(DIM_DISTRITO, 'Norte'));
    expect(resultado.rows).toHaveLength(3);
  });
});

describe('assertScopeIsEnforceable', () => {
  const resultado: QueryResult = {
    columns: [{ name: 'CasosPendientes', type: 'number' }],
    rows: [[10]],
    source: 'mock',
    generatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('falla si el dataset no trae la dimension por la que el ambito restringe', () => {
    expect(() => assertScopeIsEnforceable(resultado, scope(DIM_DISTRITO, 'Norte'))).toThrow(
      /no expone la\(s\) dimension\(es\) DimTribunal.Distrito/,
    );
  });

  it('no falla si el ambito no restringe', () => {
    expect(() => assertScopeIsEnforceable(resultado, UNRESTRICTED_SCOPE)).not.toThrow();
  });
});
