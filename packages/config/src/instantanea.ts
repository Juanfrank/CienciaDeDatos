/** Configuracion en ejecucion — seccion 3.4 y 2.2. */

export interface InstantaneaDeConfiguracion {
  /** Banderas por nombre. Solo importa el `false` explicito: ver `moduloHabilitado`. */
  banderas: Readonly<Record<string, boolean>>;
  /** Valores sueltos, como el conector activo. */
  valores: Readonly<Record<string, string>>;
  /** Cuando se leyo de la fuente. Viaja para poder decir cuan vieja es la que se esta sirviendo. */
  leidaEn: string;
}

export const INSTANTANEA_VACIA: InstantaneaDeConfiguracion = {
  banderas: {},
  valores: {},
  leidaEn: new Date(0).toISOString(),
};

/** De donde sale la configuracion. */
export interface SettingsFont {
  nombre: string;
  leer(): Promise<InstantaneaDeConfiguracion>;
}

/** Nombre de la bandera de un modulo. Un solo sitio: el job, el panel y el shell la escriben igual. */
export const banderaDeModulo = (slug: string): string => `modulo.${slug}`;

/** Clave del conector activo (2.2). */
export const CLAVE_CONECTOR = 'conector';

/** Si un modulo esta encendido. */
export const moduloHabilitado = (
  instantanea: InstantaneaDeConfiguracion,
  slug: string,
): boolean => instantanea.banderas[banderaDeModulo(slug)] !== false;

/** Los slugs apagados explicitamente, para poder DECIR cuales son y no solo actuar en consecuencia. */
export function modulosApagados(instantanea: InstantaneaDeConfiguracion): string[] {
  return Object.entries(instantanea.banderas)
    .filter(([clave, valor]) => valor === false && clave.startsWith('modulo.'))
    .map(([clave]) => clave.slice('modulo.'.length))
    .sort();
}
