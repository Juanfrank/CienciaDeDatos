/** Contrato de conector de datos — seccion 2.1 del contrato de ingenieria. */

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

/** Como se resume una medida al agrupar — el operador que Power BI llama «agregacion implicita». */
export const AGGREGATIONS = [
  'suma',
  'promedio',
  'minimo',
  'maximo',
  'recuento',
  'recuento-distinto',
  'ninguna',
] as const;

export type Aggregation = (typeof AGGREGATIONS)[number];

export function isAggregation(valor: unknown): valor is Aggregation {
  return typeof valor === 'string' && (AGGREGATIONS as readonly string[]).includes(valor);
}

/** Las que se pueden volver a aplicar sobre un resultado YA agrupado sin mentir. */
export const ADDITIVE_AGGREGATIONS: readonly Aggregation[] = ['suma', 'minimo', 'maximo'];

export function esAditiva(aggregation: Aggregation): boolean {
  return ADDITIVE_AGGREGATIONS.includes(aggregation);
}

/** Descriptor de esquema de la fuente activa. */
/** A que grano quedan las filas de un dataset cacheado. */
export type DatasetGrain = 'atomico' | 'preagregado';

export interface SchemaField {
  name: string;
  type: string;
  isMeasure: boolean;
  /**
   * Identifica la fila. Es lo que hace que un dataset sea de grano ATOMICO: si la consulta trae
   * la clave entre sus dimensiones, cada fila es un hecho y no un grupo, y entonces cualquier
   * agregacion se calcula sobre los atomos y sale bien a cualquier grano y tras cualquier filtro
   * —incluido el recorte del ambito, que quita filas DESPUES del cache—.
   */
  isKey?: boolean;
}

export interface SchemaTable {
  name: string;
  fields: SchemaField[];
}

export interface SchemaMeasure {
  name: string;
  table: string;
  /**
   * Como se resume. OBLIGATORIA y explicita, por el mismo motivo que `securityBindingRationale`
   * del registro de datasets: una decision que cambia el numero que se muestra no puede quedar
   * implicita en una constante del codigo ni en el nombre de la columna.
   */
  aggregation: Aggregation;
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
