/** Incorporacion en otros portales — seccion 4.9. */

/** Cabecera que deniega el enmarcado por completo. Es el valor por defecto de toda la aplicacion. */
export const WITHOUT_FRAMED = "frame-ancestors 'none'";

/** Origen exacto sobre https, con puerto opcional. */
const EXACT_SOURCE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*(:\d+)?$/i;

export function parsearOrigenes(valor: string | undefined): string[] {
  if (!valor) return [];

  return valor
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
    .filter((o) => EXACT_SOURCE.test(o) || o === "'self'");
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
export function framedPolicy(path: string, origenes: string[]): string {
  if (!isEmbeddablePath(path)) return WITHOUT_FRAMED;
  if (origenes.length === 0) return WITHOUT_FRAMED;
  return `frame-ancestors ${origenes.join(' ')}`;
}

/*
 * ---- Las dos formas de incrustar ----
 *
 * `completo` lleva el encabezado institucional: el emblema y el nombre del Poder Judicial. Es lo
 * que se pone en un portal ajeno, donde la vista tiene que decir de donde salen los datos.
 *
 * `limpio` no lleva encabezado. Es para incrustar dentro de un sistema que YA es del Poder
 * Judicial y ya se identifica: repetir el emblema dentro del suyo no dice nada nuevo y roba
 * altura. Lo unico que sobrevive del encabezado es QUIEN MIRA, y eso no es adorno: lo que se ve
 * depende del ambito de quien tiene la sesion abierta, asi que una vista que no diga con que
 * identidad esta dibujada invita a leerla como si fuera la de todo el mundo.
 *
 * Y no se puede salir: la version limpia no ofrece el enlace a la aplicacion. Quien la incrusta
 * la quiere como una pieza de su propia pantalla, no como una puerta a otra.
 */
export const EMBED_CHROMES = ['completo', 'limpio'] as const;

export type EmbedChrome = (typeof EMBED_CHROMES)[number];

/** El cromo pedido, o el completo. Lo desconocido cae al que MAS dice, no al que menos. */
export function embedChromeOf(valor: string | string[] | undefined): EmbedChrome {
  return valor === 'limpio' ? 'limpio' : 'completo';
}

export const EMBEDDING_PREFIX = '/embed';

export function isEmbeddablePath(path: string): boolean {
  return path === EMBEDDING_PREFIX || path.startsWith(`${EMBEDDING_PREFIX}/`);
}

export interface FramedHeaders {
  'content-security-policy': string;
  /** `X-Frame-Options` solo se pone donde se deniega. */
  'x-frame-options'?: string;
}

export function framedHeaders(path: string, origenes: string[]): FramedHeaders {
  const politica = framedPolicy(path, origenes);
  return politica === WITHOUT_FRAMED
    ? { 'content-security-policy': politica, 'x-frame-options': 'DENY' }
    : { 'content-security-policy': politica };
}

/** Codigo que el portal anfitrion pega en su pagina. */
export function embeddingCode(
  baseUrl: string,
  path: string,
  titulo: string,
  cromo: EmbedChrome = 'completo',
): string {
  const separador = path.includes('?') ? '&' : '?';
  const conCromo = cromo === 'limpio' ? `${path}${separador}cromo=limpio` : path;
  const url = `${baseUrl.replace(/\/$/, '')}${conCromo}`;
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
