/**
 * Los nombres de las cookies, en un modulo HOJA.
 *
 * Sin dependencias a proposito. El middleware corre sobre el runtime del borde, que no tiene los
 * modulos de Node, y `session.ts` importa `next/headers` y el almacen de identidad: sacar de ahi
 * un nombre de cookie arrastraria todo eso al borde y la compilacion fallaria por una constante de
 * ocho caracteres.
 *
 * Las dos viven juntas porque se emiten juntas y con la MISMA politica. Con politicas distintas el
 * navegador mandaria una y no la otra, y toda escritura quedaria rechazada sin que nada explicara
 * por que.
 */

/** La sesion. `httpOnly`: el cliente no la lee nunca. */
export const SESSION_COOKIE = 'sesion';

/** El token anti-CSRF. NO es `httpOnly`: el cliente tiene que poder leerlo y devolverlo. */
export const CSRF_COOKIE = 'csrf';

/** La cabecera por la que vuelve. Una cabecera propia no la puede poner un formulario HTML. */
export const CSRF_HEADER = 'x-csrf-token';
