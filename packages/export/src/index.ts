/** Exportacion — seccion 4.9, encolada como exige 5.3. */
export { aExcel, aPdf } from './binarios';
export {
  KEY_QUEUE,
  StoreExportQueue,
  TTL_TRABAJO_MS,
  type IExportQueue,
  type StoreExportQueueOptions,
} from './queue';
export {
  buildDocument,
  paletteOf,
  type ExportableDocument,
  type HojaExportable,
  type ExportPalette,
} from './document';
export { buildHeading, type Heading } from './heading';
export { aCsv, aSvg, escaparCsv } from './formats';
export {
  generarArtefacto,
  procesarPendientes,
  procesarTrabajo,
  type ArtefactoGenerado,
  type GenerarOptions,
  type ResolverObjetos,
} from './procesar';
export {
  FORMATS,
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
