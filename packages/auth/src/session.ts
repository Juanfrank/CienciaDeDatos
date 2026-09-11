import { randomUUID } from 'node:crypto';
import type { AuthenticatedPrincipal } from './IIdentityProvider';
import type { AppSession, ISessionStore } from './stores';

/**
 * Gestion de la sesion de aplicacion — secciones 5.3, 6.7 y 4.10.2.
 *
 * Tras autenticar por CUALQUIERA de los dos caminos se emite el mismo tipo de sesion: el resto
 * del sistema no ramifica logica segun el metodo de login.
 */

export interface SessionServiceOptions {
  store: ISessionStore;
  /** Duracion de la sesion en milisegundos. */
  ttlMs?: number;
  now?: () => number;
  newId?: () => string;
}

export class SessionService {
  private readonly store: ISessionStore;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(options: SessionServiceOptions) {
    this.store = options.store;
    this.ttlMs = options.ttlMs ?? 8 * 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? randomUUID;
  }

  /**
   * Emite una sesion. El identificador es opaco: la cookie solo lo transporta y el estado real
   * vive en la base de identidad, para que reciclar o añadir una instancia no pierda la sesion.
   */
  async issue(principal: AuthenticatedPrincipal, activeTeamId: string): Promise<AppSession> {
    const ahora = this.now();
    const session: AppSession = {
      sessionId: this.newId(),
      userId: principal.userId,
      authProvider: principal.authProvider,
      userPrincipalName: principal.userPrincipalName,
      activeTeamId,
      createdAt: new Date(ahora).toISOString(),
      expiresAt: new Date(ahora + this.ttlMs).toISOString(),
    };
    await this.store.create(session);
    return session;
  }

  async resolve(sessionId: string): Promise<AppSession | null> {
    const session = await this.store.get(sessionId);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= this.now()) {
      await this.store.delete(sessionId);
      return null;
    }
    return session;
  }

  /**
   * Cambia el equipo activo de una sesion en curso.
   *
   * Es una accion explicita de la persona usuaria, registrada en auditoria, y surte efecto de
   * inmediato SIN cerrar sesion: el ambito de datos efectivo cambia porque resolveEffectiveScope
   * parte del equipo activo. Con un token autocontenido habria que reemitirlo y gestionar su
   * revocacion; por eso la sesion es opaca y vive del lado servidor.
   */
  async switchActiveTeam(sessionId: string, teamId: string): Promise<AppSession> {
    const session = await this.resolve(sessionId);
    if (!session) throw new Error('La sesion no existe o ha expirado.');
    const actualizada: AppSession = { ...session, activeTeamId: teamId };
    await this.store.update(actualizada);
    return actualizada;
  }

  async revoke(sessionId: string): Promise<void> {
    // Revocar es borrar una fila, no esperar a que expire un token firmado.
    await this.store.delete(sessionId);
  }
}
