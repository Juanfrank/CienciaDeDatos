import type { SchemaDescriptor, SchemaMeasure } from '@app/data-contracts';

/**
 * Forma del archivo de definicion de esquema versionado que alimenta
 * MockDataConnector (seccion 2.2: "datos sinteticos con la misma forma (schema)
 * que la fuente real, generados desde un archivo de definicion de esquema
 * versionado").
 */
export interface MockSchemaField {
  name: string;
  type: string;
  isMeasure: boolean;
  /** Valores posibles de una dimension. Obligatorio para campos no-medida usados como dimension. */
  sampleValues?: string[];
  /** Rango [min, max] del que se deriva el valor de una medida. */
  range?: [number, number];
  /** Identifica la fila: una consulta que la pida devuelve HECHOS, no grupos. */
  isKey?: boolean;
  /** Cuantos hechos genera la clave. Solo tiene sentido junto a `isKey`. */
  cardinality?: number;
}

export interface MockSchemaTable {
  name: string;
  fields: MockSchemaField[];
}

export interface MockSchemaFile {
  tables: MockSchemaTable[];
  measures: SchemaMeasure[];
}

/** Proyecta el archivo de definicion al SchemaDescriptor publico, sin metadatos de generacion. */
export function toSchemaDescriptor(file: MockSchemaFile, fetchedAt: string): SchemaDescriptor {
  return {
    tables: file.tables.map((t) => ({
      name: t.name,
      fields: t.fields.map((f) => ({
        name: f.name,
        type: f.type,
        isMeasure: f.isMeasure,
        ...(f.isKey ? { isKey: true } : {}),
      })),
    })),
    measures: file.measures.map((m) => ({ ...m })),
    fetchedAt,
  };
}
