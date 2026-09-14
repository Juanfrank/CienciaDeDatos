import { es, type MessageKey } from './catalog/es';
import { en } from './catalog/en';
import { formatMessage, type MessageParameters } from './format';
import { DEFAULT_LOCALE, type Locale } from './locales';

const CATALOGOS: Record<Locale, Record<MessageKey, string>> = { es, en };

export type Translator = {
  (clave: MessageKey, parameters?: MessageParameters): string;
  locale: Locale;
  numero: (valor: number, opciones?: Intl.NumberFormatOptions) => string;
  fecha: (valor: Date | string | number, opciones?: Intl.DateTimeFormatOptions) => string;
  lista: (partes: readonly string[], tipo?: 'conjunction' | 'disjunction') => string;
};

/**
 * El traductor de un idioma.
 *
 * Una clave sin traducir cae al catalogo de referencia en vez de mostrar la clave: la aplicacion
 * esta en espanol y una pantalla con `editor.tab.data` a la vista es peor que una pantalla
 * con una palabra en el idioma equivocado. La prueba del catalogo es la que impide que eso pase.
 *
 * Trae ademas los formateadores de `Intl` atados al mismo idioma. Sin ellos, un componente acaba
 * llamando a `toLocaleString()` sin argumento y el numero sale en el idioma del servidor, que en
 * produccion no es el de quien mira.
 */
export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translator {
  const catalogo = CATALOGOS[locale] ?? es;

  const t = ((clave: MessageKey, parameters?: MessageParameters) =>
    formatMessage(catalogo[clave] ?? es[clave] ?? clave, parameters, locale)) as Translator;

  t.locale = locale;
  t.numero = (valor, opciones) => new Intl.NumberFormat(locale, opciones).format(valor);
  t.fecha = (valor, opciones) =>
    new Intl.DateTimeFormat(locale, opciones ?? { dateStyle: 'medium' }).format(new Date(valor));
  t.lista = (partes, tipo = 'conjunction') =>
    new Intl.ListFormat(locale, { style: 'long', type: tipo }).format(partes);

  return t;
}

export { CATALOGOS };
