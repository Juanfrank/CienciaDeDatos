import { NextResponse, type NextRequest } from 'next/server';
import { framedHeaders, parsearOrigenes } from './src/server/embedding';

/**
 * Cabeceras que valen para toda respuesta.
 *
 * - `X-Content-Type-Options` impide que el navegador adivine el tipo de un cuerpo y ejecute como
 *   script algo que se sirvio como datos.
 * - `Referrer-Policy` evita que la ruta de un modulo —que lleva el slug y los filtros— viaje en el
 *   `Referer` de una peticion a otro origen.
 * - `Permissions-Policy` apaga camara, microfono y geolocalizacion: esta aplicacion no los pide, y
 *   lo que no se declara se puede pedir.
 * - `Strict-Transport-Security` solo en produccion: en desarrollo no hay HTTPS y fijaria el
 *   navegador a un esquema que la maquina local no sirve.
 */
const CABECERAS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
} as const;

/** Politica de enmarcado y cabeceras de seguridad de toda la aplicacion — secciones 4.9 y 7. */
export function middleware(request: NextRequest) {
  const respuesta = NextResponse.next();
  const origenes = parsearOrigenes(process.env['EMBED_ALLOWED_ORIGINS']);

  for (const [clave, valor] of Object.entries(
    framedHeaders(request.nextUrl.pathname, origenes),
  )) {
    if (valor) respuesta.headers.set(clave, valor);
  }

  for (const [clave, valor] of Object.entries(CABECERAS)) respuesta.headers.set(clave, valor);

  if (process.env['NODE_ENV'] === 'production') {
    respuesta.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return respuesta;
}

export const config = {
  // Se excluyen los estaticos de Next y el favicon: no son enmarcables por si solos y anadirles
  // cabeceras solo gasta trabajo en cada peticion.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
