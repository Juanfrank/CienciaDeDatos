/** Punto de entrada publico de tipos: `@app/data-contracts`. */
export {
  AGGREGATIONS,
  ADDITIVE_AGGREGATIONS,
  esAditiva,
  isAggregation,
} from './IDataConnector';

export type {
  Aggregation,
  ConnectorCapabilities,
  ConnectorKind,
  FieldRef,
  DatasetGrain,
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
