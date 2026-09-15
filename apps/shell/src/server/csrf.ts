/**
 * Proteccion anti-CSRF para toda la superficie de escritura — apartado 2.16.
 *
 * Hasta ahora la UNICA proteccion contra la falsificacion de peticiones era `sameSite: 'lax'` en
 * la cookie de sesion: el navegador no la manda en una peticion que nace en otro sitio, asi que un
 * formulario escondido en una pagina ajena no podia usar la sesion de quien lo abriera.
 *
 * Eso mismo es lo que impedia incrustar la aplicacion en un portal de otra institucion: el
 * navegador tampoco manda la cookie a un iframe de otro sitio, y la vista incrustada salia
 * diciendo «se requiere iniciar sesion» aunque la sesion estuviera abierta en otra pestana.
 *
 * Levantar esa restriccion es `sameSite: 'none'`, y hacerlo a secas seria quitar la unica
 * proteccion que hay. De ahi el orden: PRIMERO el token en todas las escrituras, y solo entonces
 * la cookie puede cruzar sitios. El token no es condicional —se exige tambien con `lax`—, porque
 * una proteccion que se enciende con una variable de entorno es una proteccion que en algun
 * entorno esta apagada.
 *
 * El token es un HMAC de la sesion, no un valor guardado aparte:
 *
 * - Nada que almacenar, nada que caducar, nada que quede huerfano al revocar la sesion.
 * - Ata el token A ESA sesion. Un doble envio a secas —cookie y cabecera iguales, sin firmar— lo
 *   rompe quien pueda escribir una cookie en el dominio, por ejemplo desde un subdominio
 *   comprometido: le basta con poner el mismo valor en las dos partes. Firmado, tendria que
 *   falsificar tambien la firma, y para eso hace falta el secreto del servidor.
 */

export { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from './cookies';

/** Los metodos que NO cambian nada. El resto pasa por la puerta. */
const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const safeMethod = (metodo: string): boolean => SEGUROS.has(metodo.toUpperCase());

/**
 * Rutas de escritura que NO pueden exigir token, y por que cada una.
 *
 * La lista es corta a proposito y cada entrada tiene que justificarse: es la unica grieta de la
 * puerta, y una lista que crece por comodidad deja de ser una puerta.
 *
 * La sonda de salud NO esta aqui, aunque parezca que deberia: vive en `/health` y no bajo `/api/`,
 * asi que la puerta no la mira. Exentarla habria sido una linea que no hace nada y que el dia de
 * manana alguien leeria como que si la mira. Lo dijo la guarda de rutas, que no deja nombrar una
 * ruta que no existe.
 */
export const WITHOUT_TOKEN = [
  // Entrar es de donde SALE el token. Exigirlo aqui seria pedir la llave para recoger la llave.
  '/api/sign-in',
  // El restablecimiento lo ejecuta quien no tiene sesion: no hay ninguna que un tercero pudiera
  // montar, que es lo unico que el token impide.
  '/api/reset',
];

export const exemptPath = (path: string): boolean =>
  WITHOUT_TOKEN.some((p) => path === p || path.startsWith(`${p}/`));

const base64url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * El token de una sesion.
 *
 * Con `crypto.subtle` y no con `node:crypto` porque esto corre TAMBIEN en el middleware, que va
 * sobre el runtime del borde y no tiene los modulos de Node. Una segunda implementacion para el
 * middleware seria dos formas de calcular lo mismo, y el dia que difirieran el sintoma seria que
 * nadie puede guardar nada.
 */
export async function tokenOf(sessionId: string, secreto: string): Promise<string> {
  const codificador = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    'raw',
    codificador.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', clave, codificador.encode(sessionId)));
}

/**
 * Compara sin filtrar por el reloj.
 *
 * Un `===` sobre cadenas se para en el primer caracter distinto, y esa diferencia de tiempo se
 * mide: con suficientes intentos se adivina el token byte a byte. Aqui el margen es estrecho
 * —haria falta una sesion valida— pero la comparacion constante no cuesta nada y la otra si.
 */
export function equalTokens(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

/**
 * Como se emiten las cookies de este despliegue.
 *
 * `sameSite: 'none'` solo cuando hay origenes de incrustacion declarados Y la conexion es segura:
 * un navegador RECHAZA `SameSite=None` sin `Secure`, asi que ponerlo en desarrollo no relajaria
 * nada —dejaria la aplicacion sin sesion, que es peor—. Sin portal externo declarado se queda en
 * `lax`, que es una capa mas que no cuesta nada.
 *
 * Que la decision viva aqui y no en la ruta de acceso es lo que permite que las dos cookies —la de
 * sesion y la del token— no puedan divergir: con politicas distintas, el navegador mandaria una y
 * no la otra, y toda escritura quedaria rechazada sin explicacion.
 */
export interface CookiePolicy {
  sameSite: 'lax' | 'none';
  secure: boolean;
}

export function cookiePolicy(env: {
  embedOrigins?: string | undefined;
  nodeEnv?: string | undefined;
}): CookiePolicy {
  const enProduccion = env.nodeEnv === 'production';
  const conPortalExterno = Boolean(env.embedOrigins && env.embedOrigins.trim().length > 0);

  return conPortalExterno && enProduccion
    ? { sameSite: 'none', secure: true }
    : { sameSite: 'lax', secure: enProduccion };
}
