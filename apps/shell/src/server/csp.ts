import { framedPolicy } from './embedding';

/**
 * La politica de contenido de toda la aplicacion.
 *
 * Es el principio 1 escrito de forma que el NAVEGADOR lo haga cumplir: «ninguna peticion del
 * cliente sale del origen». Hasta ahora eso lo comprobaba una prueba de navegador que mira las
 * peticiones que salen; una prueba dice que hoy no pasa, una CSP impide que pase manana.
 *
 * Se compone aqui y no en el middleware porque hay que fusionarla con `frame-ancestors`, que ya
 * decidia el enmarcado por ruta: son dos directivas de la MISMA cabecera, y emitir dos
 * `Content-Security-Policy` no las suma, las aplica por separado y gana la mas restrictiva de
 * cada una. Una sola cabecera, una sola fuente de verdad.
 */

/** Lo que se manda a Next para que firme sus propios scripts. */
export const NONCE_HEADER = 'x-nonce';

/**
 * `script-src` lleva nonce; `style-src` lleva `unsafe-inline`.
 *
 * No es una concesion por comodidad. React escribe estilos en linea —`style={{ width }}`— en cada
 * objeto que se dimensiona, y un estilo en linea no puede sacar datos del origen: lo peor que
 * hace es pintar. Un script si, y por eso ese lleva nonce y no comodin.
 *
 * `'strict-dynamic'` queda fuera a proposito: haria que un script firmado pudiera cargar
 * cualquier otro, y aqui no hay ninguno que lo necesite.
 */
function directivas(nonce: string, enDesarrollo: boolean): string[] {
  return [
    // Todo lo que no se nombre abajo: solo del propio origen.
    "default-src 'self'",
    // `unsafe-eval` SOLO en desarrollo: el refresco en caliente de Next compila en el navegador.
    `script-src 'self' 'nonce-${nonce}'${enDesarrollo ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // `data:` para los iconos en linea; `blob:` para lo que ECharts dibuja antes de exportar.
    "img-src 'self' data: blob:",
    // Ninguna fuente externa: es el principio 1, y ya hay una prueba de navegador que lo vigila.
    "font-src 'self'",
    // El navegador solo habla con esta aplicacion.
    "connect-src 'self'",
    // Nada de Flash, applets ni objetos incrustados.
    "object-src 'none'",
    // Un `<base>` inyectado reescribiria cada URL relativa de la pagina.
    "base-uri 'self'",
    // Un formulario solo puede enviarse a esta aplicacion.
    "form-action 'self'",
  ];
}

/**
 * La cabecera completa para una ruta.
 *
 * `frame-ancestors` sale de `framedPolicy`, que ya sabe que `/embed` es enmarcable y el resto
 * no. Aqui solo se le anade el resto de la politica.
 */
export function contentSecurityPolicy(
  path: string,
  origenesEmbebido: string[],
  nonce: string,
  enDesarrollo: boolean,
): string {
  return [...directivas(nonce, enDesarrollo), framedPolicy(path, origenesEmbebido)].join('; ');
}

/**
 * Un nonce por peticion, de 128 bits.
 *
 * Reutilizarlo entre peticiones lo vuelve adivinable y, con eso, inutil: quien inyecte un script
 * solo tendria que copiar el de la pagina anterior.
 */
export function nuevoNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
}
