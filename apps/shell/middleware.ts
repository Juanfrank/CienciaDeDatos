import { NextResponse, type NextRequest } from 'next/server';
import { PATH_HEADER, NONCE_HEADER, contentSecurityPolicy, nuevoNonce } from './src/server/csp';
import { framedHeaders, parsearOrigenes } from './src/server/embedding';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  equalTokens,
  exemptPath,
  safeMethod,
  tokenOf,
} from './src/server/csrf';

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

/**
 * La puerta anti-CSRF: UNA, y en el camino de toda peticion — apartado 2.16.
 *
 * En el middleware y no repartida por los cuarenta manejadores de ruta. Una comprobacion por
 * manejador es cuarenta sitios donde acordarse, y el que se olvide es justamente el que nadie
 * mira: la ruta nueva, escrita con prisa, que no aparece en ninguna revision de seguridad porque
 * todavia no existia cuando se hizo.
 *
 * Devuelve la respuesta de rechazo, o `null` si la peticion puede seguir.
 */
async function puertaCsrf(request: NextRequest): Promise<NextResponse | null> {
  if (safeMethod(request.method)) return null;
  if (!request.nextUrl.pathname.startsWith('/api/')) return null;
  if (exemptPath(request.nextUrl.pathname)) return null;

  /*
   * Sin sesion no hay nada que falsificar.
   *
   * El token impide que un tercero MONTE sobre una sesion ajena; sin cookie de sesion no hay
   * ninguna sobre la que montar, y quien llega asi se lleva el 401 del propio manejador, que
   * explica lo que pasa mucho mejor que un 403 hablando de un token.
   */
  const sesion = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sesion) return null;

  const secreto = process.env['AUTH_PEPPER'];
  if (!secreto) {
    /*
     * Sin secreto no se puede verificar, y seguir adelante seria dejar la puerta abierta creyendo
     * que esta cerrada. Se cierra: un despliegue sin `AUTH_PEPPER` ya no puede autenticar a nadie
     * de todas formas, asi que esto no rompe nada que funcionara.
     */
    return NextResponse.json(
      { error: 'El servidor no tiene configurado el secreto de sesion.' },
      { status: 500 },
    );
  }

  const enviado = request.headers.get(CSRF_HEADER) ?? '';
  const esperado = await tokenOf(sesion, secreto);
  if (equalTokens(enviado, esperado)) return null;

  /*
   * La cookie del token se comprueba tambien, y no es redundante: si falta, lo que pasa es que la
   * sesion es de antes de que esto existiera. Decirlo aparte ahorra el rato de buscar un fallo
   * que se arregla volviendo a entrar.
   */
  const sinCookie = !request.cookies.get(CSRF_COOKIE)?.value;
  return NextResponse.json(
    {
      error: sinCookie
        ? 'Su sesion es anterior a esta version. Vuelva a iniciar sesion.'
        : 'Falta el token de la peticion o no corresponde a esta sesion.',
    },
    { status: 403 },
  );
}

/** Politica de enmarcado y cabeceras de seguridad de toda la aplicacion — secciones 4.9 y 7. */
export async function middleware(request: NextRequest) {
  const rechazo = await puertaCsrf(request);
  if (rechazo) return rechazo;

  const origenes = parsearOrigenes(process.env['EMBED_ALLOWED_ORIGINS']);
  const enDesarrollo = process.env['NODE_ENV'] !== 'production';
  const nonce = nuevoNonce();

  /*
   * El nonce viaja en la PETICION, no solo en la respuesta.
   *
   * Es lo que hace que Next firme sus propios scripts de hidratacion: los lee de la cabecera de
   * entrada al renderizar. Ponerlo solo en la respuesta deja la politica puesta y la pagina en
   * blanco, que es exactamente como una CSP mal hecha se manifiesta —sin error, sin aviso—.
   */
  const cabecerasDeEntrada = new Headers(request.headers);
  cabecerasDeEntrada.set(NONCE_HEADER, nonce);
  // La ruta, para que la disposicion raiz pueda distinguir una vista incrustada. Es lo unico que
  // la separa de cualquier otra pantalla, y una disposicion no tiene otra forma de saberlo.
  cabecerasDeEntrada.set(PATH_HEADER, request.nextUrl.pathname);

  const respuesta = NextResponse.next({ request: { headers: cabecerasDeEntrada } });

  // `framedHeaders` sigue poniendo `X-Frame-Options` donde se deniega, para los navegadores que
  // no leen `frame-ancestors`. Su CSP se descarta: la completa ya la incluye.
  const { 'x-frame-options': sinEnmarcar } = framedHeaders(request.nextUrl.pathname, origenes);
  if (sinEnmarcar) respuesta.headers.set('x-frame-options', sinEnmarcar);

  respuesta.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicy(request.nextUrl.pathname, origenes, nonce, enDesarrollo),
  );
  respuesta.headers.set(NONCE_HEADER, nonce);

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
