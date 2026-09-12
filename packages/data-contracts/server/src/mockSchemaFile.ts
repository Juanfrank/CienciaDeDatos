import type { SchemaDescriptor, SchemaMeasure } from '@app/data-contracts';

/**
 * Forma del archivo de definicion de esquema versionado que alimenta
 * MockDataConnector (seccion 2.2: "datos sinteticos con la misma forma (schema)
 * que la fuente real, generados desde un archivo de definicion de esquema
 * versionado").
 *
 * Extiende SchemaDescriptor con metadatos de GENERACION (`sampleValues`, `range`)
 * que no forman parte del contrato publico: getSchema() los elimina, de modo que
 * un modulo no pueda depender de ellos y el esquema que ve la aplicacion sea
 * indistinguible del que devolveria una fuente real.
 */
export interface MockSchemaField {
  name: string;
  type: string;
  isMeasure: boolean;
  /** Valores posibles de una dimension. Obligatorio para campos no-medida usados como dimension. */
  sampleValues?: string[];
  /** Rango [min, max] del que se deriva el valor de una medida. */
  range?: [number, number];
  /**
   * Identifica la fila: una consulta que la pida devuelve HECHOS, no grupos.
   *
   * Es lo que permite que el conector simulado tenga los dos granos de 6.6 y no solo uno. Antes
   * solo sabia hacer el producto cartesiano de las dimensiones, o sea siempre pre-agrupado, y esa
   * era la forma que el repositorio le estaba enseñando a la capa de analisis: una tabla de hechos
   * sin clave, con el promedio ya calculado dentro. Sobre esa forma un promedio no se puede
   * recalcular, y la aplicacion lo sumaba.
   */
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
