import type {
  ConnectorCapabilities,
  IDataConnector,
  QueryContext,
  QueryRequest,
  QueryResult,
  SchemaDescriptor,
} from '@app/data-contracts';
import { ConnectorNotImplementedError } from './pending';

export interface XmlaDataConnectorOptions {
  /** Endpoint XMLA del modelo semantico. Se resuelve por Azure App Configuration. */
  endpoint: string;
  catalog: string;
}

/** Conector ALTERNATIVO contra un modelo semantico SSAS/AAS (seccion 2.2). */
export class XmlaDataConnector implements IDataConnector {
  constructor(private readonly options: XmlaDataConnectorOptions) {}

  async testConnection(): Promise<boolean> {
    return false;
  }

  async getSchema(): Promise<SchemaDescriptor> {
    throw new ConnectorNotImplementedError('XmlaDataConnector', 'Fase 4 — conexion real (condicionada)');
  }

  async query(_req: QueryRequest, _ctx: QueryContext): Promise<QueryResult> {
    throw new ConnectorNotImplementedError('XmlaDataConnector', 'Fase 4 — conexion real (condicionada)');
  }

  getCapabilities(): ConnectorCapabilities {
    // RLS nativo del modelo tabular. Consecuencia de cache (6.6): un dataset servido por
    // este conector llega YA filtrado, queda ligado a un contexto de seguridad concreto
    // y su clave de cache debe incluir el hash de securityContext (6.8).
    return { nativeRls: true, calculationGroups: true, supportsTimeIntelligence: true };
  }
}
