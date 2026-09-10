import type { ConnectorKind, IDataConnector } from '@app/data-contracts';
import { MockDataConnector, type MockDataConnectorOptions } from './connectors/MockDataConnector';
import { SqlDataConnector, type SqlDataConnectorOptions } from './connectors/SqlDataConnector';
import { XmlaDataConnector, type XmlaDataConnectorOptions } from './connectors/XmlaDataConnector';

/**
 * Configuracion del conector activo.
 *
 * En ejecucion la provee Azure App Configuration, NO variables de entorno horneadas en
 * el build (seccion 2.2), para poder alternar entre mock/sql/xmla en produccion sin
 * redeploy — incluso para cambiar de Sql a Xmla si la capa de analisis cambia de decision.
 */
export interface DataConnectorConfig {
  kind: ConnectorKind;
  mock?: MockDataConnectorOptions;
  sql?: SqlDataConnectorOptions;
  xmla?: XmlaDataConnectorOptions;
}

const CONNECTOR_KINDS: readonly ConnectorKind[] = ['mock', 'sql', 'xmla'];

export function isConnectorKind(value: unknown): value is ConnectorKind {
  return typeof value === 'string' && (CONNECTOR_KINDS as readonly string[]).includes(value);
}

/**
 * Unica fabrica de conectores de la aplicacion.
 *
 * Este es el punto donde se materializa el criterio de aceptacion de 2.4: cambiar el
 * conector activo es cambiar `config.kind`, un valor de configuracion — nunca una linea
 * de codigo en apps/* ni en packages/ui-components.
 */
export function createDataConnector(config: DataConnectorConfig): IDataConnector {
  switch (config.kind) {
    case 'mock':
      return new MockDataConnector(config.mock ?? {});
    case 'sql':
      if (!config.sql) throw new Error("Falta la configuracion 'sql' para el conector activo 'sql'.");
      return new SqlDataConnector(config.sql);
    case 'xmla':
      if (!config.xmla) throw new Error("Falta la configuracion 'xmla' para el conector activo 'xmla'.");
      return new XmlaDataConnector(config.xmla);
    default: {
      const exhaustive: never = config.kind;
      throw new Error(`Conector desconocido: ${String(exhaustive)}`);
    }
  }
}
