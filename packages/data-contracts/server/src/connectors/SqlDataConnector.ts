import type {
  ConnectorCapabilities,
  IDataConnector,
  QueryContext,
  QueryRequest,
  QueryResult,
  SchemaDescriptor,
} from '@app/data-contracts';
import { ConnectorNotImplementedError } from './pending';

export interface SqlDataConnectorOptions {
  /** Nombre del recurso Azure SQL. Se resuelve por Azure App Configuration, nunca hardcodeado. */
  server: string;
  database: string;
  /** Consultas parametrizadas registradas en packages/data-contracts/sql-queries/registry.json (2.3). */
  queryRegistryPath?: string;
}

/**
 * Conector de PRIMERA CLASE contra las vistas curadas del Data Warehouse (seccion 2.2).
 * No es una excepcion temporal: puede terminar siendo la fuente definitiva si la capa
 * de analisis decide no construir un modelo semantico SSAS/AAS.
 *
 * ESTADO: pendiente. Requiere que exista una vista curada contra la cual consultar y el
 * registro de consultas de 2.3. Se implementa en la Fase 4 (conexion real), o antes si
 * la capa de analisis entrega vistas curadas.
 *
 * Cuando se implemente, dos reglas no negociables (4.7.4):
 *  - El predicado de seguridad es un parametro OBLIGATORIO de cada consulta registrada,
 *    nunca opcional ni anadido post-hoc.
 *  - La consulta vive en un archivo versionado y revisado por pares, jamas construida
 *    en tiempo de ejecucion por el modulo que la solicita.
 */
export class SqlDataConnector implements IDataConnector {
  constructor(private readonly options: SqlDataConnectorOptions) {}

  async testConnection(): Promise<boolean> {
    // Honesto: sin implementacion no hay conectividad que reportar. /health lo muestra
    // como conector activo no disponible, en vez de simular un exito.
    return false;
  }

  async getSchema(): Promise<SchemaDescriptor> {
    throw new ConnectorNotImplementedError('SqlDataConnector', 'Fase 4 — conexion real');
  }

  async query(_req: QueryRequest, _ctx: QueryContext): Promise<QueryResult> {
    throw new ConnectorNotImplementedError('SqlDataConnector', 'Fase 4 — conexion real');
  }

  getCapabilities(): ConnectorCapabilities {
    // El motor relacional no trae RLS "gratis": la aplicacion resuelve el ambito por su
    // cuenta (4.10.4). Si mas adelante se habilita CREATE SECURITY POLICY sobre el DW,
    // nativeRls pasa a true y actua como defensa en profundidad (4.10.5), nunca como
    // sustituto del calculo de la aplicacion.
    return { nativeRls: false, calculationGroups: false, supportsTimeIntelligence: false };
  }
}
