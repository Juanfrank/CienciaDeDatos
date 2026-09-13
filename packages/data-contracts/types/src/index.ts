/** Punto de entrada publico de tipos: `@app/data-contracts`. */
export {
  AGGREGATIONS,
  AGREGACIONES_ADITIVAS,
  esAditiva,
  isAggregation,
} from './IDataConnector';

export type {
  Aggregation,
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
