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

export async function pedir(
  entrada: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(entrada, init);
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
