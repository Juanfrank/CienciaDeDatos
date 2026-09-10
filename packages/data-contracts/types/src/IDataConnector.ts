/**
 * Contrato de conector de datos — seccion 2.1 del contrato de ingenieria.
 *
 * Ubicacion original en el documento: packages/data-contracts/src/IDataConnector.ts
 * Aqui vive bajo `types/` porque el paquete se publica con dos puntos de entrada
 * separados (ver packages/data-contracts/README.md): los tipos son importables por
 * cualquiera, las implementaciones solo por el job de poblacion de cache.
 *
 * Todo acceso a datos de la aplicacion depende de esta interfaz. Ningun modulo de
 * negocio puede referenciar un driver XMLA, una cadena de conexion SQL, ni el nombre
 * de un servidor o base de datos (principio 3: fuente-agnosticismo).
 */

export interface QueryContext {
  /** Identidad del usuario autenticado, propagada desde Azure AD o desde una cuenta local. */
  userId: string;
  userPrincipalName: string;
  roles: string[];
  /**
   * Contexto de seguridad para RLS dinamico — obligatorio en cada consulta.
   * Su forma de aplicarse depende del conector activo (ver 2.2 y 4.7):
   * el conector XMLA delega en el RLS nativo del modelo; el conector SQL
   * debe aplicarlo explicitamente como predicado de la consulta.
   */
  securityContext: Record<string, string | string[]>;
}

export interface FieldRef {
  table: string;
  field: string;
}

export interface QueryRequest {
  /**
   * Medidas/columnas certificadas de la fuente activa (modelo semantico o vista
   * curada del Data Warehouse) — nunca SQL libre construido por el modulo, sea
   * cual sea el conector.
   */
  measures?: string[];
  dimensions?: FieldRef[];
  filters?: Record<string, unknown>;
  topN?: number;
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
}

/** De que fuente provino un resultado. `sql-source` es produccion legitima, no una excepcion temporal. */
export type QuerySource = 'semantic-model' | 'sql-source' | 'mock';

export interface QueryResult {
  columns: { name: string; type: string }[];
  rows: unknown[][];
  /**
   * Metadatos de procedencia: de que fuente vino el dato, para trazabilidad
   * y para decidir politica de cache (ver seccion 6).
   */
  source: QuerySource;
  generatedAt: string;
}

/**
 * Descriptor de esquema de la fuente activa.
 *
 * El documento fuente referencia `SchemaDescriptor` en `IDataConnector.getSchema()`
 * pero no lo define; esta forma es la propuesta de este repositorio. Lo consumen el
 * editor de modulos (4.2), la validacion de parametros de URL (4.11) y la validacion
 * en vivo de dimensiones del panel de administracion (4.10.8), siempre leyendolo desde
 * el cache — nunca consultando la fuente en cada validacion (6.4).
 */
export interface SchemaField {
  name: string;
  type: string;
  isMeasure: boolean;
}

export interface SchemaTable {
  name: string;
  fields: SchemaField[];
}

export interface SchemaMeasure {
  name: string;
  table: string;
  description?: string;
}

export interface SchemaDescriptor {
  tables: SchemaTable[];
  measures: SchemaMeasure[];
  fetchedAt: string;
}

export interface ConnectorCapabilities {
  /** true en XMLA; false en SQL (ver 4.7). */
  nativeRls: boolean;
  /** true en XMLA; false en SQL. */
  calculationGroups: boolean;
  supportsTimeIntelligence: boolean;
}

export interface IDataConnector {
  testConnection(): Promise<boolean>;
  getSchema(): Promise<SchemaDescriptor>;
  query(req: QueryRequest, ctx: QueryContext): Promise<QueryResult>;
  /**
   * Declara que capacidades soporta esta fuente, para que la UI pueda
   * adaptarse (ver 2.2 — no todos los conectores soportan lo mismo).
   */
  getCapabilities(): ConnectorCapabilities;
}

/** Identificador del conector activo, resuelto por Azure App Configuration (2.2). */
export type ConnectorKind = 'mock' | 'sql' | 'xmla';
