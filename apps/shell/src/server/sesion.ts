import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sesiones } from './identidad';

/** Sesion del shell — secciones 4.7 y 6.7. */

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

/** Sesion o error, para los Route Handlers. */
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

/** Sesion o pantalla de acceso, para las paginas. */
export async function exigirSesionDePagina(): Promise<SesionShell> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/acceso');
  return sesion;
}

/** Cambia el equipo activo (4.10.2). */
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
