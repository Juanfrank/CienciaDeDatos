/**
 * Configuracion en ejecucion — seccion 3.4 y 2.2.
 *
 * Lo que vive aqui es lo que tiene que poder cambiar SIN redespliegue: que modulos estan
 * encendidos y cual es el conector activo. El Bicep ya lo decia —«el conector activo y los
 * feature flags se resuelven aqui en ejecucion, no se hornean en el build»— y pasaba `APP_CONFIG_
 * ENDPOINT` al contenedor; lo que faltaba era que alguien lo leyera. Hasta hoy el conector salia
 * de una variable de entorno, que solo cambia reiniciando.
 *
 * Se lee una INSTANTANEA completa y no una bandera por consulta. Con una llamada por bandera, una
 * pagina con ocho modulos en el arbol haria ocho viajes a App Configuration para pintar una barra
 * lateral; con instantanea es uno cada TTL, y ademas todas las decisiones de una misma peticion
 * salen de la misma foto, que es lo que evita que el arbol y la ruta discrepen.
 */

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

/**
 * De donde sale la configuracion.
 *
 * Es un puerto y no la clase de Azure directamente por el mismo motivo que `ICacheStore`: en
 * desarrollo y en las pruebas no hay App Configuration, y el codigo que decide si un modulo se
 * sirve no puede depender de que exista un servicio en la nube para poder probarse.
 */
export interface FuenteDeConfiguracion {
  nombre: string;
  leer(): Promise<InstantaneaDeConfiguracion>;
}

/** Nombre de la bandera de un modulo. Un solo sitio: el job, el panel y el shell la escriben igual. */
export const banderaDeModulo = (slug: string): string => `modulo.${slug}`;

/** Clave del conector activo (2.2). */
export const CLAVE_CONECTOR = 'conector';

/**
 * Si un modulo esta encendido.
 *
 * **Ausente significa encendido.** Solo un `false` explicito lo apaga. Al reves —exigir una
 * bandera para que un modulo funcione— cada modulo nuevo nacería invisible hasta que alguien se
 * acordara de crearle la suya en Azure, y el sintoma seria «publique el modulo y no aparece»,
 * que es de los que cuesta media manana diagnosticar.
 */
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
