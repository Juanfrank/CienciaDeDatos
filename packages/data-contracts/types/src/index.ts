/** Punto de entrada publico de tipos: `@app/data-contracts`. */
export {
  AGREGACIONES,
  AGREGACIONES_ADITIVAS,
  esAditiva,
  esAgregacion,
} from './IDataConnector';

export type {
  Agregacion,
  ConnectorCapabilities,
  ConnectorKind,
  FieldRef,
  GranoDeDataset,
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
