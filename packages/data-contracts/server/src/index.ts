/** Punto de entrada de SERVIDOR: `@app/data-contracts-server`. */
export { MockDataConnector, type MockDataConnectorOptions } from './connectors/MockDataConnector';
export { SqlDataConnector, type SqlDataConnectorOptions } from './connectors/SqlDataConnector';
export { XmlaDataConnector, type XmlaDataConnectorOptions } from './connectors/XmlaDataConnector';
export { ConnectorNotImplementedError } from './connectors/pending';
export { createDataConnector, isConnectorKind, type DataConnectorConfig } from './createDataConnector';
export { toSchemaDescriptor, type MockSchemaFile, type MockSchemaField, type MockSchemaTable } from './mockSchemaFile';
