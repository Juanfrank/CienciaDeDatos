import { cookies } from 'next/headers';
import { teamsOf } from './contexto';

/**
 * Sesion del shell.
 *
 * La cookie lleva un identificador OPACO y el estado real vive del lado servidor. En produccion
 * ese estado esta en la tabla de sesion de la base de identidad (6.7), a traves de
 * `SessionService`; aqui, en un mapa de proceso, porque no hay base. El contrato es el mismo:
 * cambiar el equipo activo es una escritura del lado servidor y surte efecto sin cerrar sesion.
 */

export const COOKIE_SESION = 'sesion';

export interface SesionShell {
  sessionId: string;
  userId: string;
  activeTeamId: string;
}

/**
 * Almacen de sesiones del proceso.
 *
 * Se cuelga de globalThis a proposito: el servidor de desarrollo de Next recarga los modulos en
 * caliente, y un mapa a nivel de modulo se vaciaria en cada recarga, tirando la sesion de quien
 * este navegando.
 */
const almacen: Map<string, SesionShell> = ((globalThis as Record<string, unknown>)['__sesiones'] ??=
  new Map()) as Map<string, SesionShell>;

/** Usuario por defecto del entorno de demostracion. */
const USUARIO_POR_DEFECTO = 'u-ana';

export async function obtenerSesion(): Promise<SesionShell> {
  const almacenCookies = await cookies();
  const id = almacenCookies.get(COOKIE_SESION)?.value;

  if (id) {
    const existente = almacen.get(id);
    if (existente) return existente;
  }

  // Sin sesion valida se emite una nueva con el primer equipo del usuario por defecto. En
  // produccion aqui iria la redireccion a la pantalla de inicio de sesion (4.7).
  const equipos = teamsOf(USUARIO_POR_DEFECTO);
  const primerEquipo = equipos[0];
  const sesion: SesionShell = {
    sessionId: id ?? crypto.randomUUID(),
    userId: USUARIO_POR_DEFECTO,
    activeTeamId: primerEquipo?.id ?? 'equipo-norte',
  };
  almacen.set(sesion.sessionId, sesion);
  return sesion;
}

/**
 * Cambia el equipo activo (4.10.2).
 *
 * Es una escritura del lado servidor sobre la sesion existente: el ambito de datos efectivo
 * cambia de inmediato SIN cerrar sesion, que es un criterio de aceptacion de la seccion 9.
 */
export function cambiarEquipoActivo(sessionId: string, teamId: string): SesionShell | null {
  const sesion = almacen.get(sessionId);
  if (!sesion) return null;
  const actualizada: SesionShell = { ...sesion, activeTeamId: teamId };
  almacen.set(sessionId, actualizada);
  return actualizada;
}

export function cambiarUsuario(sessionId: string, userId: string): SesionShell | null {
  const sesion = almacen.get(sessionId);
  if (!sesion) return null;
  const equipos = teamsOf(userId);
  const primero = equipos[0];
  const actualizada: SesionShell = {
    ...sesion,
    userId,
    activeTeamId: primero?.id ?? sesion.activeTeamId,
  };
  almacen.set(sessionId, actualizada);
  return actualizada;
}
