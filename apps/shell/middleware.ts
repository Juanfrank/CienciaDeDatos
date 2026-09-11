import { NextResponse, type NextRequest } from 'next/server';
import { cabecerasDeEnmarcado, parsearOrigenes } from './src/server/incrustacion';

/**
 * Politica de enmarcado de toda la aplicacion — seccion 4.9.
 *
 * Por defecto NADIE puede enmarcar esta aplicacion. Solo las rutas de incrustacion lo permiten,
 * y solo desde los origenes configurados. Que la denegacion sea el valor por defecto y no una
 * excepcion tiene consecuencia propia: cierra el clickjacking en todas las pantallas, incluido
 * el panel de administracion, sin que haya que acordarse de ninguna.
 *
 * Va en el middleware y no en `next.config.mjs` porque la lista de portales es configuracion de
 * ejecucion: en Azure la resuelve App Configuration, y un valor horneado en la construccion
 * obligaria a reconstruir la imagen para autorizar un portal nuevo.
 */
export function middleware(request: NextRequest) {
  const respuesta = NextResponse.next();
  const origenes = parsearOrigenes(process.env['EMBED_ALLOWED_ORIGINS']);

  for (const [clave, valor] of Object.entries(
    cabecerasDeEnmarcado(request.nextUrl.pathname, origenes),
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
