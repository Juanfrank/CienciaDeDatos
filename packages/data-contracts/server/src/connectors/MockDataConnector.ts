import type {
  ConnectorCapabilities,
  FieldRef,
  IDataConnector,
  QueryContext,
  QueryRequest,
  QueryResult,
  SchemaDescriptor,
} from '@app/data-contracts';
import { type MockSchemaFile, toSchemaDescriptor } from '../mockSchemaFile';
import defaultSchema from '../../schema/mock-schema.json' with { type: 'json' };

export interface MockDataConnectorOptions {
  /** Archivo de esquema versionado. Por defecto, packages/data-contracts/server/schema/mock-schema.json */
  schema?: MockSchemaFile;
  /** Semilla del generador determinista. La misma semilla produce siempre los mismos datos. */
  seed?: number;
  /**
   * Capacidades declaradas. Por defecto imita a SqlDataConnector (`nativeRls: false`),
   * que es el camino mas exigente: obliga a que la aplicacion resuelva el ambito por su
   * cuenta (4.10.4) en vez de confiar en que la fuente lo haga.
   *
   * Poner `nativeRls: true` hace que este conector filtre por `securityContext` antes de
   * devolver, imitando a XmlaDataConnector — util para probar las DOS estrategias de
   * cacheo de la seccion 6.6 sin depender de que exista una fuente real.
   */
  capabilities?: Partial<ConnectorCapabilities>;
  /** Tope de filas generadas antes de aplicar topN. Evita productos cartesianos enormes. */
  maxRows?: number;
}

const DEFAULT_CAPABILITIES: ConnectorCapabilities = {
  nativeRls: false,
  calculationGroups: false,
  supportsTimeIntelligence: true,
};

/** PRNG determinista (mulberry32): mismos parametros, mismos datos, en cualquier maquina. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash estable de una cadena, para que el valor de una medida no dependa del orden de generacion. */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const fieldKey = (ref: FieldRef): string => `${ref.table}.${ref.field}`;

/** Normaliza el valor de un filtro a la lista de valores permitidos. */
function allowedValues(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

/**
 * Conector de desarrollo local y CI/CD (seccion 2.2).
 *
 * Es un PAR de los otros dos conectores, no un andamio: sirve datos sinteticos con la
 * misma forma que la fuente real y respeta el mismo contrato, para que la prueba de
 * fuente-agnosticismo (2.4) sea ejecutable desde el dia 1.
 */
export class MockDataConnector implements IDataConnector {
  private readonly schema: MockSchemaFile;
  private readonly seed: number;
  private readonly capabilities: ConnectorCapabilities;
  private readonly maxRows: number;

  constructor(options: MockDataConnectorOptions = {}) {
    this.schema = options.schema ?? (defaultSchema as unknown as MockSchemaFile);
    this.seed = options.seed ?? 20260101;
    this.capabilities = { ...DEFAULT_CAPABILITIES, ...options.capabilities };
    this.maxRows = options.maxRows ?? 5000;
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async getSchema(): Promise<SchemaDescriptor> {
    // fetchedAt determinista: el esquema simulado no cambia entre llamadas, y una
    // marca de tiempo variable haria que la entrada cacheada del esquema (6.4) se
    // viera como modificada en cada ciclo del job.
    return toSchemaDescriptor(this.schema, new Date(0).toISOString());
  }

  getCapabilities(): ConnectorCapabilities {
    return { ...this.capabilities };
  }

  async query(req: QueryRequest, ctx: QueryContext): Promise<QueryResult> {
    const dimensions = req.dimensions ?? [];
    const measures = req.measures ?? [];

    for (const dim of dimensions) this.assertDimensionExists(dim);
    for (const measure of measures) this.assertMeasureExists(measure);

    let rows = this.buildDimensionRows(dimensions);
    rows = this.applyFilters(rows, dimensions, req.filters);

    // Solo cuando el conector declara RLS nativo filtra la propia "fuente".
    // Con nativeRls=false, el filtrado de seguridad es responsabilidad de la
    // aplicacion (4.10.4) y este conector devuelve el superconjunto — que es
    // justo lo que permite cachear un dataset compartido entre equipos (6.6).
    if (this.capabilities.nativeRls) {
      rows = this.applyFilters(rows, dimensions, ctx.securityContext);
    }

    const withMeasures = rows.map((row) => [
      ...row,
      ...measures.map((measure) => this.measureValue(measure, row, dimensions)),
    ]);

    const columns = [
      ...dimensions.map((d) => ({ name: fieldKey(d), type: 'string' })),
      ...measures.map((m) => ({ name: m, type: 'number' })),
    ];

    const ordered = this.applyOrderBy(withMeasures, columns, req.orderBy);
    const limited = req.topN !== undefined ? ordered.slice(0, req.topN) : ordered;

    return {
      columns,
      rows: limited,
      source: 'mock',
      generatedAt: new Date().toISOString(),
    };
  }

  private assertDimensionExists(ref: FieldRef): void {
    const table = this.schema.tables.find((t) => t.name === ref.table);
    const field = table?.fields.find((f) => f.name === ref.field && !f.isMeasure);
    if (!field) {
      throw new Error(
        `Dimension desconocida en el esquema activo: ${fieldKey(ref)}. ` +
          `El editor de modulos debe marcar el campo como roto (4.2), no fallar en silencio.`,
      );
    }
  }

  private assertMeasureExists(name: string): void {
    if (!this.schema.measures.some((m) => m.name === name)) {
      throw new Error(`Medida no certificada en el esquema activo: ${name}`);
    }
  }

  private sampleValuesFor(ref: FieldRef): string[] {
    const table = this.schema.tables.find((t) => t.name === ref.table);
    const field = table?.fields.find((f) => f.name === ref.field);
    return field?.sampleValues ?? [];
  }

  /** Producto cartesiano de los valores declarados para las dimensiones pedidas. */
  private buildDimensionRows(dimensions: FieldRef[]): unknown[][] {
    if (dimensions.length === 0) return [[]];
    let rows: unknown[][] = [[]];
    for (const dim of dimensions) {
      const values = this.sampleValuesFor(dim);
      const next: unknown[][] = [];
      for (const row of rows) {
        for (const value of values) {
          if (next.length >= this.maxRows) break;
          next.push([...row, value]);
        }
      }
      rows = next;
    }
    return rows;
  }

  private applyFilters(
    rows: unknown[][],
    dimensions: FieldRef[],
    filters: Record<string, unknown> | undefined,
  ): unknown[][] {
    if (!filters) return rows;
    const active: { index: number; values: string[] }[] = [];
    for (const [key, value] of Object.entries(filters)) {
      const index = dimensions.findIndex((d) => fieldKey(d) === key);
      const values = allowedValues(value);
      // Un filtro sobre una dimension que la consulta no pidio no puede evaluarse fila a
      // fila, asi que se ignora aqui. El ambito de acceso NO depende de esto: se aplica
      // como filtro explicito de QueryRequest antes de llegar al conector (4.10.4).
      if (index >= 0 && values !== null) active.push({ index, values });
    }
    if (active.length === 0) return rows;
    return rows.filter((row) => active.every((f) => f.values.includes(String(row[f.index]))));
  }

  /** Valor determinista derivado de la semilla, la medida y la combinacion de dimensiones. */
  private measureValue(measure: string, row: unknown[], dimensions: FieldRef[]): number {
    const definition = this.schema.tables
      .flatMap((t) => t.fields)
      .find((f) => f.name === measure && f.isMeasure);
    const [min, max] = definition?.range ?? [0, 1000];
    const key = `${this.seed}|${measure}|${dimensions.map((d, i) => `${fieldKey(d)}=${String(row[i])}`).join('&')}`;
    const rand = mulberry32(hashString(key))();
    return Math.round(min + rand * (max - min));
  }

  private applyOrderBy(
    rows: unknown[][],
    columns: { name: string }[],
    orderBy: QueryRequest['orderBy'],
  ): unknown[][] {
    if (!orderBy || orderBy.length === 0) return rows;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      for (const clause of orderBy) {
        const index = columns.findIndex((c) => c.name === clause.field);
        if (index < 0) continue;
        const left = a[index];
        const right = b[index];
        let cmp: number;
        if (typeof left === 'number' && typeof right === 'number') cmp = left - right;
        else cmp = String(left).localeCompare(String(right));
        if (cmp !== 0) return clause.direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
    return sorted;
  }
}
