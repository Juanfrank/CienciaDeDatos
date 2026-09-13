/**
 * Idiomas admitidos y negociacion, segun BCP 47.
 *
 * El espanol es el idioma de la aplicacion y el catalogo de referencia: se escribe primero y es
 * contra el que se comparan los demas. El ingles existe desde el principio para que la capa de
 * traduccion no sea teorica — con un solo idioma pasan desapercibidos los errores que solo
 * aparecen con dos, como una frase partida en concatenaciones o un plural resuelto a mano.
 */

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** El idioma en el que se escribe el catalogo y al que se cae cuando no hay nada mejor. */
export const DEFAULT_LOCALE: Locale = 'es';

export const isLocale = (valor: unknown): valor is Locale =>
  typeof valor === 'string' && (LOCALES as readonly string[]).includes(valor);

/**
 * Elige el mejor idioma a partir de una lista de preferencias.
 *
 * Compara por la subetiqueta primaria, asi que `es-DO` y `es-ES` resuelven al mismo catalogo: uno
 * por region multiplicaria el trabajo de traduccion sin cambiar una sola cadena.
 */
export function negotiateLocale(preferences: readonly string[]): Locale {
  for (const preferencia of preferences) {
    const primaria = preferencia.trim().toLowerCase().split('-')[0];
    if (isLocale(primaria)) return primaria;
  }
  return DEFAULT_LOCALE;
}

/** Despieza una cabecera `Accept-Language` y la ordena por factor de calidad. */
export function headerPreferences(pageHeader: string | null | undefined): string[] {
  if (!pageHeader) return [];
  return pageHeader
    .split(',')
    .map((parte) => {
      const [etiqueta = '', ...parameters] = parte.split(';').map((p) => p.trim());
      const q = parameters.find((p) => p.startsWith('q='));
      return { etiqueta, calidad: q ? Number(q.slice(2)) : 1 };
    })
    .filter((p) => p.etiqueta !== '' && Number.isFinite(p.calidad))
    .sort((a, b) => b.calidad - a.calidad)
    .map((p) => p.etiqueta);
}
