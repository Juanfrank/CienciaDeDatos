/**
 * Punto de entrada de SERVIDOR: `@app/data-contracts-server`.
 *
 * Contiene las implementaciones de IDataConnector. Importarlo desde un modulo de negocio,
 * desde packages/ui-components o desde el shell es un ERROR DE LINTER
 * (@nx/enforce-module-boundaries, tag `type:server-data` — ver eslint.config.mjs).
 *
 * El unico proyecto autorizado a importarlo es apps/cache-populator, que es la unica via
 * por la que se invoca IDataConnector.query() (principio 2 y seccion 6.4). Esa restriccion
 * es lo que hace verificable el criterio de aceptacion de la seccion 9: "el conector solo
 * se invoca desde el job de poblacion de cache, nunca desde el camino de lectura de una
 * solicitud de usuario".
 */
export { MockDataConnector, type MockDataConnectorOptions } from './connectors/MockDataConnector';
export { SqlDataConnector, type SqlDataConnectorOptions } from './connectors/SqlDataConnector';
export { XmlaDataConnector, type XmlaDataConnectorOptions } from './connectors/XmlaDataConnector';
export { ConnectorNotImplementedError } from './connectors/pending';
export { createDataConnector, isConnectorKind, type DataConnectorConfig } from './createDataConnector';
export { toSchemaDescriptor, type MockSchemaFile, type MockSchemaField, type MockSchemaTable } from './mockSchemaFile';
