/**
 * Consulta en lenguaje natural — seccion 4.9.
 *
 * Etiquetado `type:util`: son funciones puras sobre un vocabulario que le entregan. No lee
 * datos, no conoce el cache y no construye consultas — resuelve una SELECCION y una URL.
 */
export { ResolvedorLocal, normalizar, urlDeConsulta } from './resolver';
export type {
  ConsultaResuelta,
  INaturalLanguageResolver,
  Intencion,
  TerminoDeVocabulario,
  ValorDeDimension,
  Vocabulario,
} from './types';
