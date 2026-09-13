import type { AuthProvider } from './IIdentityProvider';

/** Puertos de persistencia de identidad. */

export interface LocalCredentialRecord {
  userId: string;
  /** Correo verificado. Es el userPrincipalName de la cuenta local (4.7.3). */
  email: string;
  /** Hash Argon2id. Nunca la contraseña, ni cifrada de forma reversible. */
  passwordHash: string;
  /** Hashes anteriores, para la no reutilizacion de las ultimas N (4.7.2). */
  passwordHistory: string[];
  /** Secreto TOTP cifrado en reposo. Segundo factor obligatorio para cuentas locales. */
  totpSecret?: string;
  failedAttempts: number;
  /** Instante hasta el que la cuenta esta bloqueada, en epoch ms. */
  lockedUntil?: number;
  emailVerified: boolean;
}

export interface ILocalIdentityStore {
  findByEmail(email: string): Promise<LocalCredentialRecord | null>;
  save(record: LocalCredentialRecord): Promise<void>;
}

/** Sesion de aplicacion — secciones 5.3 y 6.7. */
export interface AppSession {
  sessionId: string;
  userId: string;
  authProvider: AuthProvider;
  userPrincipalName: string;
  /** Equipo activo por sesion (4.10.2). Nunca la union implicita de todos los equipos. */
  activeTeamId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ISessionStore {
  create(session: AppSession): Promise<void>;
  get(sessionId: string): Promise<AppSession | null>;
  update(session: AppSession): Promise<void>;
  delete(sessionId: string): Promise<void>;
  /** Borra TODAS las sesiones de una persona. */
  deleteAllFor(userId: string): Promise<void>;
}

/** Evento de inicio de sesion — seccion 7. */
export interface LoginAuditEvent {
  timestamp: string;
  authProvider: AuthProvider;
  /** Identificador intentado. Puede no corresponder a ninguna cuenta existente. */
  attemptedPrincipal: string;
  outcome: 'exito' | 'fallo';
  reason?: string;
  sourceIp?: string;
  userId?: string;
}

export interface IAuditLog {
  recordLogin(event: LoginAuditEvent): Promise<void>;
}

/** Implementaciones en memoria, para pruebas y desarrollo local. */
export class InMemoryLocalIdentityStore implements ILocalIdentityStore {
  private readonly byEmail = new Map<string, LocalCredentialRecord>();

  async findByEmail(email: string): Promise<LocalCredentialRecord | null> {
    return this.byEmail.get(email.toLowerCase()) ?? null;
  }

  async save(record: LocalCredentialRecord): Promise<void> {
    this.byEmail.set(record.email.toLowerCase(), { ...record });
  }
}

export class InMemorySessionStore implements ISessionStore {
  private readonly map = new Map<string, AppSession>();

  async create(session: AppSession): Promise<void> {
    this.map.set(session.sessionId, { ...session });
  }
  async get(sessionId: string): Promise<AppSession | null> {
    return this.map.get(sessionId) ?? null;
  }
  async update(session: AppSession): Promise<void> {
    this.map.set(session.sessionId, { ...session });
  }
  async delete(sessionId: string): Promise<void> {
    this.map.delete(sessionId);
  }
  async deleteAllFor(userId: string): Promise<void> {
    for (const [id, sesion] of this.map) {
      if (sesion.userId === userId) this.map.delete(id);
    }
  }
}

export class InMemoryAuditLog implements IAuditLog {
  readonly events: LoginAuditEvent[] = [];
  async recordLogin(event: LoginAuditEvent): Promise<void> {
    this.events.push(event);
  }
}
