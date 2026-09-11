/**
 * Exportacion — seccion 4.9, encolada como exige 5.3.
 *
 * Etiquetado `type:server`: genera archivos en el servidor y no puede importar
 * `type:server-data`. La exportacion lee del cache como cualquier otra lectura; el resolutor de
 * objetos se inyecta desde el shell, que es quien sabe resolver el ambito de una persona.
 */
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
  type DocumentoExportable,
  type HojaExportable,
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
