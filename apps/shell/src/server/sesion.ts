import { cookies } from 'next/headers';
import { escribir, leer } from './almacenCompartido';
import { teamsOf } from './contexto';

/**
 * Sesion del shell.
 *
 * La cookie lleva un identificador OPACO y el estado real vive del lado servidor (ADR-006). Ese
 * estado esta en el almacen COMPARTIDO, no en un mapa de proceso: con dos instancias detras de
 * un balanceador, quien cayera en la segunda perderia la sesion, y la seccion 9 lo prohibe
 * expresamente. En produccion la misma forma vive en la tabla de sesion de la base de identidad.
 */

export const COOKIE_SESION = 'sesion';

export interface SesionShell {
  sessionId: string;
  userId: string;
  activeTeamId: string;
}

const clave = (sessionId: string): string => `app:sesion:${sessionId}`;

/** Usuario por defecto del entorno de demostracion. */
const USUARIO_POR_DEFECTO = 'u-ana';

export async function obtenerSesion(): Promise<SesionShell> {
  const almacenCookies = await cookies();
  const id = almacenCookies.get(COOKIE_SESION)?.value;

  if (id) {
    const existente = await leer<SesionShell>(clave(id));
    if (existente) return existente;
  }

  // Sin sesion valida se emite una nueva con el primer equipo del usuario por defecto. En
  // produccion aqui iria la redireccion a la pantalla de inicio de sesion (4.7).
  const equipos = await teamsOf(USUARIO_POR_DEFECTO);
  const primerEquipo = equipos[0];
  const sesion: SesionShell = {
    sessionId: id ?? crypto.randomUUID(),
    userId: USUARIO_POR_DEFECTO,
    activeTeamId: primerEquipo?.id ?? 'equipo-norte',
  };
  await escribir(clave(sesion.sessionId), sesion);
  return sesion;
}

/**
 * Cambia el equipo activo (4.10.2).
 *
 * Es una escritura del lado servidor sobre la sesion existente: el ambito de datos efectivo
 * cambia de inmediato SIN cerrar sesion, que es un criterio de aceptacion de la seccion 9.
 */
export async function cambiarEquipoActivo(
  sessionId: string,
  teamId: string,
): Promise<SesionShell | null> {
  const sesion = await leer<SesionShell>(clave(sessionId));
  if (!sesion) return null;

  const actualizada: SesionShell = { ...sesion, activeTeamId: teamId };
  await escribir(clave(sessionId), actualizada);
  return actualizada;
}

export async function cambiarUsuario(
  sessionId: string,
  userId: string,
): Promise<SesionShell | null> {
  const sesion = await leer<SesionShell>(clave(sessionId));
  if (!sesion) return null;

  const equipos = await teamsOf(userId);
  const primero = equipos[0];
  const actualizada: SesionShell = {
    ...sesion,
    userId,
    activeTeamId: primero?.id ?? sesion.activeTeamId,
  };
  await escribir(clave(sessionId), actualizada);
  return actualizada;
}
