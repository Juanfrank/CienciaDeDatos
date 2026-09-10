/**
 * Punto de entrada publico de tipos: `@app/data-contracts`.
 *
 * Solo tipos. Importable por cualquier proyecto, incluidos modulos de negocio y
 * componentes de UI, porque no arrastra ninguna implementacion ni credencial.
 * Las implementaciones viven en `@app/data-contracts-server` y su importacion
 * desde un modulo o desde el shell es un error de linter (ver eslint.config.mjs).
 */
export type {
  ConnectorCapabilities,
  ConnectorKind,
  FieldRef,
  IDataConnector,
  QueryContext,
  QueryRequest,
  QueryResult,
  QuerySource,
  SchemaDescriptor,
  SchemaField,
  SchemaMeasure,
  SchemaTable,
} from './IDataConnector';
