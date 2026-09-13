import type { ConnectorKind, IDataConnector } from '@app/data-contracts';
import { MockDataConnector, type MockDataConnectorOptions } from './connectors/MockDataConnector';
import { SqlDataConnector, type SqlDataConnectorOptions } from './connectors/SqlDataConnector';
import { XmlaDataConnector, type XmlaDataConnectorOptions } from './connectors/XmlaDataConnector';

/** Configuracion del conector activo. */
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

/** Unica fabrica de conectores de la aplicacion. */
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
