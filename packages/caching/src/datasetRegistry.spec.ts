import { describe, expect, it } from 'vitest';
import {
  type DatasetRegistry,
  datasetsForModule,
  defaultRegistry,
  getDataset,
  validateRegistry,
} from './datasetRegistry';

const base = defaultRegistry.datasets[0];
if (!base) throw new Error('El registro del repositorio no puede estar vacio.');

describe('registro de datasets (6.6)', () => {
  it('el registro del repositorio es valido', () => {
    expect(validateRegistry()).toEqual([]);
  });

  it('todo dataset declara explicitamente su estrategia de aislamiento y por que', () => {
    for (const d of defaultRegistry.datasets) {
      expect(['none', 'connector-native']).toContain(d.securityBinding);
      expect(d.securityBindingRationale.trim().length).toBeGreaterThan(0);
    }
  });

  it('todo dataset declara su propia recurrencia, no un intervalo global', () => {
    for (const d of defaultRegistry.datasets) {
      expect(d.recurrence.trim().length).toBeGreaterThan(0);
      expect(d.recurrenceRationale.trim().length).toBeGreaterThan(0);
    }
  });

  it('permite trazar que datasets consume un modulo (3.3)', () => {
    expect(datasetsForModule('casos-pendientes').map((d) => d.datasetId)).toContain(
      'casos-por-distrito-trimestre',
    );
  });

  it('falla de forma explicita ante un dataset desconocido', () => {
    expect(() => getDataset('inventado')).toThrow(/no esta en el registro/);
  });
});

describe('validateRegistry detecta configuraciones que causarian fugas o redundancia', () => {
  const conDataset = (overrides: Partial<typeof base>): DatasetRegistry => ({
    datasets: [{ ...base, ...overrides }],
  });

  it('detecta un dataset compartido que no trae la dimension por la que se restringe', () => {
    const problemas = validateRegistry(
      conDataset({
        query: { measures: ['CasosIngresados'], dimensions: [{ table: 'DimTiempo', field: 'Anio' }] },
        scopeDimensions: [{ table: 'DimTribunal', field: 'Distrito' }],
        securityBinding: 'none',
      }),
    );
    expect(problemas[0]?.problem).toMatch(/no esta entre las dimensiones de la consulta/);
  });

  it('detecta un securityBinding sin justificacion', () => {
    const problemas = validateRegistry(conDataset({ securityBindingRationale: '  ' }));
    expect(problemas[0]?.problem).toMatch(/Falta securityBindingRationale/);
  });

  it('detecta un dataset que nadie consume', () => {
    const problemas = validateRegistry(conDataset({ consumedByModules: [] }));
    expect(problemas[0]?.problem).toMatch(/Ningun modulo lo consume/);
  });

  it('detecta ids duplicados', () => {
    const problemas = validateRegistry({ datasets: [base, base] });
    expect(problemas.some((p) => p.problem.includes('duplicado'))).toBe(true);
  });
});
