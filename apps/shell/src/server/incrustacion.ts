/**
 * Incorporacion en otros portales — seccion 4.9.
 *
 * Lo primero que hay que fijar, porque ordena todo lo demas: UNA VISTA INCRUSTADA NO ES UNA
 * VISTA PUBLICA. Quien la mira sigue teniendo que estar autenticado y sigue viendo lo que su
 * ambito permite. La alternativa comoda —un token de incrustacion que salte la autenticacion
 * para que el portal anfitrion "simplemente funcione"— convertiria un iframe en un canal por el
 * que sale cualquier dato a cualquiera que copie la URL, y ninguna de las puertas de la seccion
 * 4.10 lo impediria.
 *
 * De ahi que aqui no haya ningun token: solo una lista de portales que TIENEN PERMITIDO
 * enmarcarnos. La autorizacion de datos la sigue haciendo la sesion, como en cualquier otra
 * pagina.
 */

/** Cabecera que deniega el enmarcado por completo. Es el valor por defecto de toda la aplicacion. */
export const SIN_ENMARCADO = "frame-ancestors 'none'";

/**
 * Origen exacto sobre https, con puerto opcional.
 *
 * Se exige origen completo (`https://portal.ejemplo.do`) y no dominio suelto: `frame-ancestors`
 * distingue esquema, y una entrada sin esquema admitiria `http://`, que es enmarcar datos
 * institucionales sobre una conexion que cualquiera puede leer.
 *
 * Y no se admite comodin de subdominio, aunque la especificacion de CSP lo permita. Un
 * `https://*.ejemplo.do` autoriza cualquier subdominio presente y futuro, incluido el que
 * alguien consiga apropiarse; para una lista de unos pocos portales conocidos, escribirlos uno
 * a uno cuesta poco y no deja esa puerta.
 */
const ORIGEN_EXACTO = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*(:\d+)?$/i;

export function parsearOrigenes(valor: string | undefined): string[] {
  if (!valor) return [];

  return valor
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
    .filter((o) => ORIGEN_EXACTO.test(o) || o === "'self'");
}

/** Entradas descartadas por no tener la forma exigida, para poder avisar en vez de callar. */
export function origenesDescartados(valor: string | undefined): string[] {
  if (!valor) return [];
  const validos = new Set(parsearOrigenes(valor));
  return valor
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0 && !validos.has(o));
}

/**
 * Politica de enmarcado para una ruta.
 *
 * Sin lista configurada, la ruta de incrustacion tambien deniega. Falla cerrado a proposito: una
 * configuracion olvidada tiene que dejar la aplicacion sin incrustar, no incrustable por
 * cualquiera.
 */
export function politicaDeEnmarcado(ruta: string, origenes: string[]): string {
  if (!esRutaIncrustable(ruta)) return SIN_ENMARCADO;
  if (origenes.length === 0) return SIN_ENMARCADO;
  return `frame-ancestors ${origenes.join(' ')}`;
}

export const PREFIJO_INCRUSTACION = '/incrustar';

export function esRutaIncrustable(ruta: string): boolean {
  return ruta === PREFIJO_INCRUSTACION || ruta.startsWith(`${PREFIJO_INCRUSTACION}/`);
}

export interface CabecerasDeEnmarcado {
  'content-security-policy': string;
  /**
   * `X-Frame-Options` solo se pone donde se deniega.
   *
   * No admite lista de origenes —`ALLOW-FROM` se retiro de los navegadores— asi que en la ruta
   * incrustable no se emite y manda `frame-ancestors`. Ponerlo ahi bloquearia la incrustacion en
   * los navegadores que dan prioridad a la cabecera antigua.
   */
  'x-frame-options'?: string;
}

export function cabecerasDeEnmarcado(ruta: string, origenes: string[]): CabecerasDeEnmarcado {
  const politica = politicaDeEnmarcado(ruta, origenes);
  return politica === SIN_ENMARCADO
    ? { 'content-security-policy': politica, 'x-frame-options': 'DENY' }
    : { 'content-security-policy': politica };
}

/** Codigo que el portal anfitrion pega en su pagina. */
export function codigoDeIncrustacion(urlBase: string, ruta: string, titulo: string): string {
  const url = `${urlBase.replace(/\/$/, '')}${ruta}`;
  return [
    `<iframe src="${url}"`,
    `        title="${titulo.replace(/"/g, '&quot;')}"`,
    '        width="100%" height="640" style="border:0"',
    // El iframe no necesita ningun permiso del navegador: no usa camara, ni micro, ni ubicacion.
    // Declararlo explicitamente evita que el portal anfitrion se los conceda sin querer.
    '        allow=""',
    // Sin `credentialless`: la vista incrustada NECESITA la cookie de sesion para saber quien
    // mira y aplicar su ambito. Un iframe sin credenciales mostraria la pantalla de inicio de
    // sesion, que es el comportamiento correcto pero no el util.
    '        loading="lazy"></iframe>',
  ].join('\n');
}
