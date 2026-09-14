/** Configuracion en ejecucion — seccion 3.4 y 2.2. */

export interface SettingsSnapshot {
  /** Banderas por nombre. Solo importa el `false` explicito: ver `enabledModule`. */
  banderas: Readonly<Record<string, boolean>>;
  /** Valores sueltos, como el conector activo. */
  valores: Readonly<Record<string, string>>;
  /** Cuando se leyo de la fuente. Viaja para poder decir cuan vieja es la que se esta sirviendo. */
  leidaEn: string;
}

export const EMPTY_SNAPSHOT: SettingsSnapshot = {
  banderas: {},
  valores: {},
  leidaEn: new Date(0).toISOString(),
};

/** De donde sale la configuracion. */
export interface SettingsFont {
  nombre: string;
  leer(): Promise<SettingsSnapshot>;
}

/** Nombre de la bandera de un modulo. Un solo sitio: el job, el panel y el shell la escriben igual. */
export const moduleFlag = (slug: string): string => `modulo.${slug}`;

/** Clave del conector activo (2.2). */
export const CONNECTOR_KEY = 'conector';

/** Si un modulo esta encendido. */
export const enabledModule = (
  snapshot: SettingsSnapshot,
  slug: string,
): boolean => snapshot.banderas[moduleFlag(slug)] !== false;

/** Los slugs apagados explicitamente, para poder DECIR cuales son y no solo actuar en consecuencia. */
export function disabledModules(snapshot: SettingsSnapshot): string[] {
  return Object.entries(snapshot.banderas)
    .filter(([clave, valor]) => valor === false && clave.startsWith('modulo.'))
    .map(([clave]) => clave.slice('modulo.'.length))
    .sort();
}
