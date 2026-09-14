import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessions } from './identity';

/** Sesion del shell — secciones 4.7 y 6.7. */

export const SESSION_COOKIE = 'sesion';

export interface ShellSession {
  sessionId: string;
  userId: string;
  activeTeamId: string;
  /** Por que puerta entro. Solo para auditoria y reglas propias del proveedor (4.7.3). */
  authProvider: 'azure-ad' | 'local';
}

export async function sessionGet(): Promise<ShellSession | null> {
  const cookiesStore = await cookies();
  const id = cookiesStore.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const sesion = await sessions.resolve(id);
  if (!sesion) return null;

  return {
    sessionId: sesion.sessionId,
    userId: sesion.userId,
    activeTeamId: sesion.activeTeamId,
    authProvider: sesion.authProvider,
  };
}

/** Sesion o error, para los Route Handlers. */
export class WithoutErrorSession extends Error {
  constructor() {
    super('Se requiere iniciar sesion.');
    this.name = 'WithoutErrorSession';
  }
}

export async function sessionRequire(): Promise<ShellSession> {
  const sesion = await sessionGet();
  if (!sesion) throw new WithoutErrorSession();
  return sesion;
}

/** Sesion o pantalla de acceso, para las paginas. */
export async function pageSessionRequire(): Promise<ShellSession> {
  const sesion = await sessionGet();
  if (!sesion) redirect('/acceso');
  return sesion;
}

/** Cambia el equipo activo (4.10.2). */
export async function activeChangeTeam(
  sessionId: string,
  teamId: string,
): Promise<ShellSession | null> {
  try {
    const sesion = await sessions.switchActiveTeam(sessionId, teamId);
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

export async function closeSession(sessionId: string): Promise<void> {
  // Revocar es borrar la fila, no esperar a que caduque un token firmado.
  await sessions.revoke(sessionId);
}
