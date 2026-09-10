import { describe, expect, it } from 'vitest';
import { MockDataConnector } from './connectors/MockDataConnector';
import { SqlDataConnector } from './connectors/SqlDataConnector';
import { XmlaDataConnector } from './connectors/XmlaDataConnector';
import { createDataConnector, isConnectorKind } from './createDataConnector';

describe('createDataConnector', () => {
  it('selecciona el conector por configuracion, no por codigo (criterio 2.4)', () => {
    expect(createDataConnector({ kind: 'mock' })).toBeInstanceOf(MockDataConnector);
    expect(createDataConnector({ kind: 'sql', sql: { server: 's', database: 'd' } })).toBeInstanceOf(
      SqlDataConnector,
    );
    expect(
      createDataConnector({ kind: 'xmla', xmla: { endpoint: 'e', catalog: 'c' } }),
    ).toBeInstanceOf(XmlaDataConnector);
  });

  it('los tres conectores satisfacen el mismo contrato', () => {
    const conectores = [
      createDataConnector({ kind: 'mock' }),
      createDataConnector({ kind: 'sql', sql: { server: 's', database: 'd' } }),
      createDataConnector({ kind: 'xmla', xmla: { endpoint: 'e', catalog: 'c' } }),
    ];
    for (const conector of conectores) {
      expect(typeof conector.testConnection).toBe('function');
      expect(typeof conector.getSchema).toBe('function');
      expect(typeof conector.query).toBe('function');
      const caps = conector.getCapabilities();
      expect(typeof caps.nativeRls).toBe('boolean');
      expect(typeof caps.calculationGroups).toBe('boolean');
      expect(typeof caps.supportsTimeIntelligence).toBe('boolean');
    }
  });

  it('falla de forma explicita si falta la configuracion del conector elegido', () => {
    expect(() => createDataConnector({ kind: 'sql' })).toThrow(/Falta la configuracion 'sql'/);
    expect(() => createDataConnector({ kind: 'xmla' })).toThrow(/Falta la configuracion 'xmla'/);
  });

  it('valida el identificador de conector recibido de configuracion externa', () => {
    expect(isConnectorKind('mock')).toBe(true);
    expect(isConnectorKind('sql')).toBe(true);
    expect(isConnectorKind('xmla')).toBe(true);
    expect(isConnectorKind('postgres')).toBe(false);
    expect(isConnectorKind(undefined)).toBe(false);
  });
});
