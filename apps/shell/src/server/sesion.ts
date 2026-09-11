import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sesiones } from './identidad';

/**
 * Sesion del shell — secciones 4.7 y 6.7.
 *
 * La cookie lleva un identificador OPACO y el estado real vive del lado servidor, en el almacen
 * compartido, para que reciclar o anadir una instancia no pierda la sesion (criterio de la
 * seccion 9).
 *
 * Lo que cambia respecto de antes, y es el punto: `obtenerSesion` ya NO emite una sesion cuando
 * no hay ninguna. Devuelve null, y quien la pide decide —una pagina redirige a la pantalla de
 * acceso, una ruta de API responde 401—. Emitirla sola era comodo para desarrollar y significaba
 * que la aplicacion no tenia autenticacion: cualquiera que llegara a una URL ya estaba dentro.
 */

export const COOKIE_SESION = 'sesion';

export interface SesionShell {
  sessionId: string;
  userId: string;
  activeTeamId: string;
  /** Por que puerta entro. Solo para auditoria y reglas propias del proveedor (4.7.3). */
  authProvider: 'azure-ad' | 'local';
}

export async function obtenerSesion(): Promise<SesionShell | null> {
  const almacenCookies = await cookies();
  const id = almacenCookies.get(COOKIE_SESION)?.value;
  if (!id) return null;

  const sesion = await sesiones.resolve(id);
  if (!sesion) return null;

  return {
    sessionId: sesion.sessionId,
    userId: sesion.userId,
    activeTeamId: sesion.activeTeamId,
    authProvider: sesion.authProvider,
  };
}

/**
 * Sesion o error, para los Route Handlers.
 *
 * Se separa de `obtenerSesion` para que el caso "no hay sesion" sea imposible de olvidar: quien
 * llame a esta obtiene una sesion o una excepcion, nunca un null que se pueda ignorar.
 */
export class SinSesionError extends Error {
  constructor() {
    super('Se requiere iniciar sesion.');
    this.name = 'SinSesionError';
  }
}

export async function exigirSesion(): Promise<SesionShell> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new SinSesionError();
  return sesion;
}

/**
 * Sesion o pantalla de acceso, para las paginas.
 *
 * Cada pagina protegida la llama por su cuenta en vez de delegar en el layout raiz. Es
 * deliberado: un layout de Next.js NO se vuelve a ejecutar en cada navegacion del cliente, asi
 * que un guardian puesto solo alli deja de mirar en cuanto se navega por dentro. Ademas una ruta
 * nueva que olvide el guardian queda cerrada por defecto solo si el guardian esta en la ruta.
 */
export async function exigirSesionDePagina(): Promise<SesionShell> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/acceso');
  return sesion;
}

/**
 * Cambia el equipo activo (4.10.2).
 *
 * Escritura del lado servidor sobre la sesion existente: el ambito de datos efectivo cambia de
 * inmediato SIN cerrar sesion ni reemitir credenciales, que es un criterio de la seccion 9 y la
 * razon de que la sesion sea opaca en vez de un token autocontenido.
 */
export async function cambiarEquipoActivo(
  sessionId: string,
  teamId: string,
): Promise<SesionShell | null> {
  try {
    const sesion = await sesiones.switchActiveTeam(sessionId, teamId);
    return {
      sessionId: sesion.sessionId,
      userId: sesion.userId,
      activeTeamId: sesion.activeTeamId,
      authProvider: sesion.authProvider,
    };
  } catch {
    return null;
  }
}

export async function cerrarSesion(sessionId: string): Promise<void> {
  // Revocar es borrar la fila, no esperar a que caduque un token firmado.
  await sesiones.revoke(sessionId);
}
