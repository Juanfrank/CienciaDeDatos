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
  DEFAULT_LOCALE,
  isLocale,
  negotiateLocale,
  headerPreferences,
  type Locale,
} from './locales';
export { formatMessage, type MessageParameters } from './format';
export { es, type MessageKey } from './catalog/es';
export { en } from './catalog/en';
export { CATALOGOS, createTranslator, type Translator } from './translator';
