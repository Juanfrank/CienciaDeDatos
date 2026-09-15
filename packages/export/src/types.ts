import type { QueryResult } from '@app/data-contracts';

/** Exportacion — seccion 4.9, con la restriccion arquitectonica de 5.3. */

/*
 * Tres formatos, y ninguno es una imagen.
 *
 * Hubo un cuarto, `svg`. Lo que se exporta de un modulo son sus DATOS, y una imagen no se abre en
 * una hoja de calculo, no se adjunta a un expediente y no se puede comprobar contra nada: es una
 * captura de pantalla con mas pasos. Se retira del tipo y no solo del desplegable, para que no
 * quede una ruta que siga aceptandolo por la puerta de atras.
 */
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export const FORMATS: readonly ExportFormat[] = ['csv', 'xlsx', 'pdf'];

export const MIME_KINDS: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export type ExportStatus = 'encolada' | 'procesando' | 'lista' | 'fallida';

/** Procedencia de la vista exportada — seccion 4.6. */
export interface ExportProvenance {
  isPersonalized: boolean;
  label: string;
}

export interface ExportRequest {
  moduleSlug: string;
  moduleName: string;
  pageSlug?: string;
  format: ExportFormat;
  /** Quien exporta. El contenido ya viene filtrado por SU ambito. */
  requestedBy: string;
  /** Equipo activo en el momento de exportar, para la trazabilidad del archivo. */
  teamId: string;
  provenance: ExportProvenance;
  /** Filtros EFECTIVAMENTE aplicados, tras intersecarlos con el ambito — no los que se pidieron. */
  appliedFilters: Record<string, string[]>;
  /** Filtros pedidos que el ambito descarto por completo. Se anotan aparte, sin sus valores. */
  outOfScopeFilters?: string[];
  /** Marca de tiempo del dato exportado (4.8). */
  generatedAt?: string;
}

/** Un objeto del modulo, ya resuelto, filtrado y PROYECTADO, listo para volcarse. */
export interface ExportableObject {
  title: string;
  result: QueryResult;
  /** Las mismas filas, con cada cifra YA formateada como se ve en pantalla. */
  textos?: string[][];
  /** Lo que el objeto dice ADEMAS de sus cifras: la meta, el umbral, la regla de color. */
  notas?: string[];
  /**
   * true si el objeto es un grafico. Lo decide quien cablea, que conoce el catalogo; el paquete
   * de exportacion no puede depender del repositorio de objetos (regla de limites) y tampoco
   * deberia: aqui solo hace falta saber cual de las hojas merece dibujarse como imagen.
   */
  isChart?: boolean;
}

export interface ExportJob {
  id: string;
  request: ExportRequest;
  status: ExportStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** Presente solo cuando el estado es 'lista'. */
  artifact?: {
    filename: string;
    contentType: string;
    /** Contenido en base64: el store de cache es JSON y no admite binario en crudo. */
    contentBase64: string;
    bytes: number;
  };
}

/** Nombre de archivo legible y con fecha, para que no se acumulen "export(3).xlsx". */
export function fileName(request: ExportRequest, ahora: Date): string {
  const fecha = ahora.toISOString().slice(0, 10);
  const base = request.moduleSlug.replace(/[^a-z0-9-]+/gi, '-');
  const sufijo = request.provenance.isPersonalized ? '-vista-personalizada' : '';
  return `${base}-${fecha}${sufijo}.${request.format}`;
}

/** Clave del trabajo en el store. Los trabajos de exportacion no son datos de negocio. */
export const jobKey = (id: string): string => `export:job:${id}`;
