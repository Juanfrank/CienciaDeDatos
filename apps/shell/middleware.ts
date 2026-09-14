import { NextResponse, type NextRequest } from 'next/server';
import { framedHeaders, parsearOrigenes } from './src/server/embedding';

/** Politica de enmarcado de toda la aplicacion — seccion 4.9. */
export function middleware(request: NextRequest) {
  const respuesta = NextResponse.next();
  const origenes = parsearOrigenes(process.env['EMBED_ALLOWED_ORIGINS']);

  for (const [clave, valor] of Object.entries(
    framedHeaders(request.nextUrl.pathname, origenes),
  )) {
    if (valor) respuesta.headers.set(clave, valor);
  }

  return respuesta;
}

export const config = {
  // Se excluyen los estaticos de Next y el favicon: no son enmarcables por si solos y anadirles
  // cabeceras solo gasta trabajo en cada peticion.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
