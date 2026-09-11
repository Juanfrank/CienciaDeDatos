import { describe, expect, it } from 'vitest';
import { buildCacheKey, datasetKeyPrefix, stableHash } from './cacheKey';

const dims = [{ table: 'DimTribunal', field: 'Distrito' }];

describe('stableHash — canonicalizacion', () => {
  it('no depende del orden de escritura de las claves', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
  });

  it('no depende del orden de los valores de un filtro, que es un conjunto', () => {
    expect(stableHash({ d: ['Norte', 'Este'] })).toBe(stableHash({ d: ['Este', 'Norte'] }));
  });

  it('distingue contenidos distintos', () => {
    expect(stableHash({ d: ['Norte'] })).not.toBe(stableHash({ d: ['Este'] }));
  });

  it('ignora las claves undefined, para que omitir un campo opcional no fragmente el cache', () => {
    expect(stableHash({ a: 1, b: undefined })).toBe(stableHash({ a: 1 }));
  });
});

describe('buildCacheKey — aislamiento por contexto de seguridad (6.8)', () => {
  it('con securityBinding "none" la clave NO incluye el contexto: el dataset se comparte', () => {
    const norte = buildCacheKey({
      datasetId: 'd1',
      dimensions: dims,
      securityBinding: 'none',
      securityContext: { 'DimTribunal.Distrito': ['Norte'] },
    });
    const este = buildCacheKey({
      datasetId: 'd1',
      dimensions: dims,
      securityBinding: 'none',
      securityContext: { 'DimTribunal.Distrito': ['Este'] },
    });
    expect(norte).toBe(este);
    expect(norte).not.toContain(':sec:');
  });

  it('con securityBinding "connector-native" dos contextos distintos NUNCA comparten clave', () => {
    const norte = buildCacheKey({
      datasetId: 'd1',
      dimensions: dims,
      securityBinding: 'connector-native',
      securityContext: { 'DimTribunal.Distrito': ['Norte'] },
    });
    const este = buildCacheKey({
      datasetId: 'd1',
      dimensions: dims,
      securityBinding: 'connector-native',
      securityContext: { 'DimTribunal.Distrito': ['Este'] },
    });
    expect(norte).not.toBe(este);
    expect(norte).toContain(':sec:');
  });

  it('el mismo contexto de seguridad si reutiliza la entrada', () => {
    const input = {
      datasetId: 'd1',
      dimensions: dims,
      securityBinding: 'connector-native' as const,
      securityContext: { 'DimTribunal.Distrito': ['Norte'] },
    };
    expect(buildCacheKey(input)).toBe(buildCacheKey({ ...input }));
  });

  it('falla de forma ruidosa si un dataset ligado a un contexto no lo recibe', () => {
    expect(() =>
      buildCacheKey({ datasetId: 'd1', dimensions: dims, securityBinding: 'connector-native' }),
    ).toThrow(/no puede construirse sin securityContext/);
  });

  it('filtros distintos producen claves distintas', () => {
    const a = buildCacheKey({ datasetId: 'd1', filters: { x: '1' }, securityBinding: 'none' });
    const b = buildCacheKey({ datasetId: 'd1', filters: { x: '2' }, securityBinding: 'none' });
    expect(a).not.toBe(b);
  });

  it('los filtros de la URL entran en la clave como cualquier otro filtro (4.11)', () => {
    const sinFiltro = buildCacheKey({ datasetId: 'd1', securityBinding: 'none' });
    const conFiltroDeUrl = buildCacheKey({
      datasetId: 'd1',
      filters: { 'DimTribunal.Distrito': ['Norte'] },
      securityBinding: 'none',
    });
    expect(sinFiltro).not.toBe(conFiltroDeUrl);
  });

  it('toda clave empieza por el prefijo del dataset, para la invalidacion dirigida (6.5)', () => {
    const key = buildCacheKey({ datasetId: 'casos', dimensions: dims, securityBinding: 'none' });
    expect(key.startsWith(datasetKeyPrefix('casos'))).toBe(true);
  });

  it('datasets distintos nunca colisionan', () => {
    const a = buildCacheKey({ datasetId: 'd1', securityBinding: 'none' });
    const b = buildCacheKey({ datasetId: 'd2', securityBinding: 'none' });
    expect(a).not.toBe(b);
  });
});
