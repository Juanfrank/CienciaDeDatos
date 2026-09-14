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

/** Como se expresa un filtro, de la URL al dato. La MISMA regla en el servidor y en el cliente. */
export {
  FILTER_SUFFIXES,
  applyFilters,
  filterIsEmpty,
  parseFilters,
  splitFilterKey,
  valueMatches,
} from './filterExpression';

export type { FieldFilter, FilterSuffix } from './filterExpression';
