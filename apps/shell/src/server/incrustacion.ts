/** Incorporacion en otros portales — seccion 4.9. */

/** Cabecera que deniega el enmarcado por completo. Es el valor por defecto de toda la aplicacion. */
export const SIN_ENMARCADO = "frame-ancestors 'none'";

/** Origen exacto sobre https, con puerto opcional. */
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

/** Politica de enmarcado para una ruta. */
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
  /** `X-Frame-Options` solo se pone donde se deniega. */
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
