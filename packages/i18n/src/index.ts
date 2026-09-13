/**
 * Internacionalizacion (i18n).
 *
 * El idioma de la aplicacion es el espanol y asi seguira: lo que esta capa aporta es que ninguna
 * cadena visible viva dentro de un componente. Anadir un idioma pasa a ser escribir un catalogo,
 * no recorrer trescientos archivos buscando comillas.
 *
 * Los catalogos estan en sintaxis ICU MessageFormat, que es el estandar que entienden las
 * herramientas de traduccion. Los plurales y los formatos de numero y fecha los resuelve `Intl`.
 */
export {
  LOCALES,
  LOCALE_POR_DEFECTO,
  esLocale,
  negociarLocale,
  preferenciasDeCabecera,
  type Locale,
} from './locales';
export { formatearMensaje, type ParametrosDeMensaje } from './formato';
export { es, type ClaveDeMensaje } from './catalogo/es';
export { en } from './catalogo/en';
export { CATALOGOS, crearTraductor, type Traductor } from './traductor';
