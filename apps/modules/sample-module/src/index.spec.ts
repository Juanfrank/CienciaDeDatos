import { describe, expect, it } from 'vitest';
import { contract, describeQuery } from './index';

describe('sample-module', () => {
  it('declara su consumo de datos en el contrato de modulo (3.3)', () => {
    expect(contract.slug).toBe('casos-pendientes');
    expect(contract.consumes.datasets).not.toHaveLength(0);
  });

  it('fija la version exacta de cada componente de UI que usa (4.5)', () => {
    for (const componente of contract.uiComponents) {
      expect(componente.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('describe su consulta sin ejecutarla', () => {
    const query = describeQuery();
    expect(query.measures).toEqual(contract.consumes.measures);
    expect(query.dimensions).toEqual(contract.consumes.dimensions);
  });
});
