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
 * Como se resume una medida al agrupar — el operador que Power BI llama «agregacion implicita».
 *
 * Estaba implicito, y eso era el fallo: la capa de presentacion sumaba SIEMPRE, asi que una
 * columna de dias promedio se mostraba como la suma de sus promedios (10 593 dias en vez de 165).
 * El nombre de la columna llevaba la semantica —«DiasPromedio...»— y el nombre de una columna no
 * es un sitio donde la aplicacion pueda leer nada.
 *
 * `ninguna` es el caso del modelo semantico: una medida DAX YA viene calculada por el motor y la
 * aplicacion no puede volver a agregarla, ni sumandola ni promediandola.
 */
export const AGREGACIONES = [
  'suma',
  'promedio',
  'minimo',
  'maximo',
  'recuento',
  'recuento-distinto',
  'ninguna',
] as const;

export type Agregacion = (typeof AGREGACIONES)[number];

export function esAgregacion(valor: unknown): valor is Agregacion {
  return typeof valor === 'string' && (AGREGACIONES as readonly string[]).includes(valor);
}

/**
 * Las que se pueden volver a aplicar sobre un resultado YA agrupado sin mentir.
 *
 * `suma`, `minimo` y `maximo` son asociativas: sumar sumas da la suma, y el maximo de los maximos
 * es el maximo. Las demas no. Un promedio de promedios solo coincide con el promedio real si
 * todos los grupos pesan igual, y un recuento distinto no se combina entre grupos de ninguna
 * forma. Esta distincion solo importa cuando el dataset viene pre-agrupado: sobre filas atomicas
 * cualquier operador es correcto, porque no hay una agregacion previa que arruinar.
 */
export const AGREGACIONES_ADITIVAS: readonly Agregacion[] = ['suma', 'minimo', 'maximo'];

export function esAditiva(agregacion: Agregacion): boolean {
  return AGREGACIONES_ADITIVAS.includes(agregacion);
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
/**
 * A que grano quedan las filas de un dataset cacheado.
 *
 * - `atomico`: la consulta trae la CLAVE del hecho, asi que cada fila es un hecho y no un grupo.
 *   Cualquier agregacion se calcula sobre los atomos y sale bien a cualquier grano, con cualquier
 *   filtro y despues del recorte del ambito. Cuesta tamaño: pesa lo que pese la tabla de hechos.
 *
 * - `preagregado`: la consulta ya agrupo. Ocupa una fraccion y sirve igual de bien para lo
 *   aditivo, pero un promedio o un recuento distinto ya no se pueden recalcular desde aqui: lo
 *   que queda en el cache es un resultado, no los datos con los que se obtuvo.
 *
 * Vive en los contratos de datos —y no en el registro de cache, que es quien lo declara— porque
 * la validacion del editor tiene que consultarlo y no puede importar el paquete de cache.
 */
export type GranoDeDataset = 'atomico' | 'preagregado';

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
  aggregation: Agregacion;
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
