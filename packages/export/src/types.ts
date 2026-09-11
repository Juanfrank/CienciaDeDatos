import type { QueryResult } from '@app/data-contracts';

/**
 * Exportacion — seccion 4.9, con la restriccion arquitectonica de 5.3.
 *
 * La seccion 5.3 nombra la exportacion COMO EJEMPLO de operacion de larga duracion:
 *
 *   "Cualquier operacion de larga duracion (exportacion de un reporte grande, por ejemplo) se
 *    despacha a una cola y se procesa fuera del ciclo de solicitud HTTP, con estado de progreso
 *    consultable — NUNCA bloqueando una instancia del App Service."
 *
 * Por eso exportar no es "generar el archivo y devolverlo": es encolar un trabajo, consultar su
 * estado y descargar cuando este listo. Se aplica a TODAS las exportaciones, no solo a las
 * grandes: si el camino rapido fuera sincrono, el dia que alguien exporte algo grande por esa via
 * bloquearia una instancia, y nadie se acordaria de por que existian dos caminos.
 */

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'svg';

export const FORMATOS: readonly ExportFormat[] = ['csv', 'xlsx', 'pdf', 'svg'];

export const TIPOS_MIME: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  svg: 'image/svg+xml',
};

export type ExportStatus = 'encolada' | 'procesando' | 'lista' | 'fallida';

/**
 * Procedencia de la vista exportada — seccion 4.6.
 *
 * "Distinguir visualmente una vista personalizada de la vista institucional oficial, INCLUIDA AL
 * EXPORTAR/COMPARTIR." De ahi que viaje en la peticion y se incruste en los cuatro formatos: un
 * PDF que circula por correo sin esa marca es exactamente el caso que 4.6 quiere evitar.
 */
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
  /**
   * Filtros EFECTIVAMENTE aplicados, tras intersecarlos con el ambito — no los que se pidieron.
   *
   * La diferencia importa: un archivo que anuncia "Distrito = Este" y no trae ninguna fila hace
   * creer que no hay casos en el Este, cuando lo que ocurre es que quien exporto no tiene acceso
   * a ese distrito. Lo que se escribe en el archivo tiene que describir lo que el archivo
   * contiene.
   */
  appliedFilters: Record<string, string[]>;
  /** Filtros pedidos que el ambito descarto por completo. Se anotan aparte, sin sus valores. */
  outOfScopeFilters?: string[];
  /** Marca de tiempo del dato exportado (4.8). */
  generatedAt?: string;
}

/** Un objeto del modulo, ya resuelto y filtrado, listo para volcarse. */
export interface ExportableObject {
  title: string;
  result: QueryResult;
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
export function nombreDeArchivo(request: ExportRequest, ahora: Date): string {
  const fecha = ahora.toISOString().slice(0, 10);
  const base = request.moduleSlug.replace(/[^a-z0-9-]+/gi, '-');
  const sufijo = request.provenance.isPersonalized ? '-vista-personalizada' : '';
  return `${base}-${fecha}${sufijo}.${request.format}`;
}

/** Clave del trabajo en el store. Los trabajos de exportacion no son datos de negocio. */
export const claveDeTrabajo = (id: string): string => `export:job:${id}`;
