/** Exportacion — seccion 4.9, encolada como exige 5.3. */
export { aExcel, aPdf } from './binarios';
export {
  CLAVE_COLA,
  StoreExportQueue,
  TTL_TRABAJO_MS,
  type IExportQueue,
  type StoreExportQueueOptions,
} from './cola';
export {
  construirDocumento,
  paletaDe,
  type DocumentoExportable,
  type HojaExportable,
  type PaletaDeExportacion,
} from './documento';
export { construirEncabezado, type Encabezado } from './encabezado';
export { aCsv, aSvg, escaparCsv } from './formatos';
export {
  generarArtefacto,
  procesarPendientes,
  procesarTrabajo,
  type ArtefactoGenerado,
  type GenerarOptions,
  type ResolverObjetos,
} from './procesar';
export {
  FORMATOS,
  TIPOS_MIME,
  claveDeTrabajo,
  nombreDeArchivo,
  type ExportFormat,
  type ExportJob,
  type ExportProvenance,
  type ExportRequest,
  type ExportStatus,
  type ExportableObject,
} from './types';
