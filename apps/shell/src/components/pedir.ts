import { CSRF_COOKIE, CSRF_HEADER } from '../server/cookies';

/**
 * `fetch` que no lanza.
 *
 * Todos los controles del panel tienen la misma forma: encienden su bandera de «en curso»,
 * esperan al servidor y la apagan. Con `fetch` a pelo, una caida de red —no hay conexion, el
 * servidor no esta, la maquina acaba de despertar del suspendido— hace que la espera LANCE, y
 * entonces la linea que apaga la bandera no llega a ejecutarse: el boton se queda deshabilitado
 * para siempre, sin decir nada, y la unica salida es recargar la pagina.
 *
 * Devolviendo `null` en vez de lanzar, la misma linea de siempre sigue corriendo y el control
 * entra por su camino de error, que ya estaba escrito. Es lo contrario de envolver dieciseis
 * componentes en dieciseis `try`: un solo sitio donde la regla vive, y ninguna forma de
 * olvidarse de ella al escribir el diecisiete.
 */
export const SIN_RED = 'No hay conexion con el servidor. Intentelo de nuevo.';

/**
 * El token anti-CSRF, leido de su cookie — apartado 2.16.
 *
 * La cookie NO es `httpOnly` justamente para esto: el doble envio consiste en devolver por una
 * cabecera lo que el navegador manda por la cookie. Una pagina de otro sitio no puede hacer
 * ninguna de las dos cosas —ni leer la cookie ni poner una cabecera propia—, y ahi esta la
 * proteccion.
 */
function tokenDeLaCookie(): string {
  if (typeof document === 'undefined') return '';
  const encontrada = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return encontrada ? decodeURIComponent(encontrada.slice(CSRF_COOKIE.length + 1)) : '';
}

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * `fetch` que no lanza, y que ademas firma lo que escribe.
 *
 * El token se pone AQUI y en ningun otro sitio. Repartirlo por los cuarenta y seis sitios que
 * escriben seria cuarenta y seis ocasiones de olvidarlo, y el olvido no se ve al escribir el
 * codigo —se ve como un 403 en produccion, en la pantalla de alguien—. Lo que impide que aparezca
 * el cuarenta y siete es la guarda de `tools/coherence`, que no deja escribir con `fetch` a pelo.
 */
export async function pedir(
  entrada: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response | null> {
  const metodo = (init?.method ?? 'GET').toUpperCase();
  const conToken: RequestInit | undefined = SEGUROS.has(metodo)
    ? init
    : { ...init, headers: { ...(init?.headers as Record<string, string>), [CSRF_HEADER]: tokenDeLaCookie() } };

  try {
    return await fetch(entrada, conToken);
  } catch {
    return null;
  }
}

/**
 * El mensaje de error de una respuesta, ya resuelto.
 *
 * `null` es «no hubo respuesta»; un cuerpo que no sea JSON tampoco es raro —un 502 de un proxy
 * devuelve HTML—, y por eso el `catch` del `json()`. `porDefecto` es lo que el control quiera
 * decir cuando el servidor no explica nada.
 */
export async function motivoDeFallo(
  respuesta: Response | null,
  porDefecto: string,
): Promise<string> {
  if (!respuesta) return SIN_RED;
  const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
  return cuerpo.error ?? porDefecto;
}
