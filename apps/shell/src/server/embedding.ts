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
export function embeddingCode(baseUrl: string, path: string, titulo: string): string {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
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
