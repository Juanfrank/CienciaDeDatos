import { es, type ClaveDeMensaje } from './catalogo/es';
import { en } from './catalogo/en';
import { formatearMensaje, type ParametrosDeMensaje } from './formato';
import { LOCALE_POR_DEFECTO, type Locale } from './locales';

const CATALOGOS: Record<Locale, Record<ClaveDeMensaje, string>> = { es, en };

export type Traductor = {
  (clave: ClaveDeMensaje, parametros?: ParametrosDeMensaje): string;
  locale: Locale;
  numero: (valor: number, opciones?: Intl.NumberFormatOptions) => string;
  fecha: (valor: Date | string | number, opciones?: Intl.DateTimeFormatOptions) => string;
  lista: (partes: readonly string[], tipo?: 'conjunction' | 'disjunction') => string;
};

/**
 * El traductor de un idioma.
 *
 * Una clave sin traducir cae al catalogo de referencia en vez de mostrar la clave: la aplicacion
 * esta en espanol y una pantalla con `editor.pestana.datos` a la vista es peor que una pantalla
 * con una palabra en el idioma equivocado. La prueba del catalogo es la que impide que eso pase.
 *
 * Trae ademas los formateadores de `Intl` atados al mismo idioma. Sin ellos, un componente acaba
 * llamando a `toLocaleString()` sin argumento y el numero sale en el idioma del servidor, que en
 * produccion no es el de quien mira.
 */
export function crearTraductor(locale: Locale = LOCALE_POR_DEFECTO): Traductor {
  const catalogo = CATALOGOS[locale] ?? es;

  const t = ((clave: ClaveDeMensaje, parametros?: ParametrosDeMensaje) =>
    formatearMensaje(catalogo[clave] ?? es[clave] ?? clave, parametros, locale)) as Traductor;

  t.locale = locale;
  t.numero = (valor, opciones) => new Intl.NumberFormat(locale, opciones).format(valor);
  t.fecha = (valor, opciones) =>
    new Intl.DateTimeFormat(locale, opciones ?? { dateStyle: 'medium' }).format(new Date(valor));
  t.lista = (partes, tipo = 'conjunction') =>
    new Intl.ListFormat(locale, { style: 'long', type: tipo }).format(partes);

  return t;
}

export { CATALOGOS };
