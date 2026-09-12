/**
 * Punto de entrada publico de tipos: `@app/data-contracts`.
 *
 * Tipos, y el vocabulario cerrado que los acompaña: las agregaciones posibles y los dos
 * predicados que las clasifican. Son datos y funciones puras, sin estado ni dependencias — no
 * arrastran ninguna implementacion de conector ni ninguna credencial, que es la razon de que este
 * punto de entrada sea importable por cualquier proyecto, modulos de negocio y componentes de UI
 * incluidos. Viven aqui y no en la UI porque la lista de agregaciones es parte del contrato de la
 * fuente: quien la publica es quien declara como se resume cada medida.
 *
 * Las implementaciones viven en `@app/data-contracts-server` y su importacion desde un modulo o
 * desde el shell es un error de linter (ver eslint.config.mjs).
 */
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
