import { describe, expect, it } from 'vitest';
import type { QueryContext } from '@app/data-contracts';
import { SqlDataConnector } from './SqlDataConnector';
import { XmlaDataConnector } from './XmlaDataConnector';

const ctx: QueryContext = {
  userId: 'u-1',
  userPrincipalName: 'persona@institucion.gob',
  roles: [],
  securityContext: {},
};

describe('conectores pendientes de implementacion', () => {
  it('SqlDataConnector declara que la aplicacion debe resolver el RLS por su cuenta', () => {
    expect(new SqlDataConnector({ server: 's', database: 'd' }).getCapabilities().nativeRls).toBe(false);
  });

  it('XmlaDataConnector declara RLS nativo, lo que liga su cache a un contexto de seguridad (6.8)', () => {
    expect(new XmlaDataConnector({ endpoint: 'e', catalog: 'c' }).getCapabilities().nativeRls).toBe(true);
  });

  it('reportan falta de conectividad en vez de simular exito', async () => {
    await expect(new SqlDataConnector({ server: 's', database: 'd' }).testConnection()).resolves.toBe(false);
    await expect(new XmlaDataConnector({ endpoint: 'e', catalog: 'c' }).testConnection()).resolves.toBe(false);
  });

  it('fallan de forma ruidosa y trazable al consultar', async () => {
    await expect(new SqlDataConnector({ server: 's', database: 'd' }).query({}, ctx)).rejects.toThrow(
      /SqlDataConnector todavia no esta implementado/,
    );
    await expect(new XmlaDataConnector({ endpoint: 'e', catalog: 'c' }).query({}, ctx)).rejects.toThrow(
      /XmlaDataConnector todavia no esta implementado/,
    );
  });
});
