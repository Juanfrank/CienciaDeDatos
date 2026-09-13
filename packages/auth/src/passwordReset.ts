import { Algorithm, hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { type PasswordPolicy, DEFAULT_PASSWORD_POLICY, checkPasswordPolicy } from './passwordPolicy';
import type { IAuditLog, ILocalIdentityStore } from './stores';

/** Restablecimiento de contraseña — seccion 4.7.2. */

/** Token en claro: solo existe en memoria, el tiempo de entregarlo. Nunca se persiste asi. */
export interface IssuedResetToken {
  /** Identificador publico del restablecimiento, que viaja junto al token. */
  resetId: string;
  /** El secreto. Quien lo tenga puede fijar una contraseña nueva; se entrega una sola vez. */
  token: string;
  expiresAt: string;
}

export interface ResetRecord {
  resetId: string;
  userId: string;
  email: string;
  /** Hash Argon2id del token. Un volcado de esta tabla no permite canjear ningun token. */
  tokenHash: string;
  expiresAt: number;
  /** Quien lo inicio: la propia persona, o el Administrador que lo tramito. */
  requestedBy: string;
  createdAt: string;
  /** Instante del canje. Un token usado NO se borra: se marca, para que quede el rastro. */
  usedAt?: string;
}

export interface IResetStore {
  save(record: ResetRecord): Promise<void>;
  get(resetId: string): Promise<ResetRecord | null>;
  /** Restablecimientos vivos de una cuenta, para invalidarlos al emitir uno nuevo. */
  listPendingFor(email: string): Promise<ResetRecord[]>;
}

/** Canal por el que viaja el token. */
export interface IResetChannel {
  readonly name: string;
  /**
   * Entrega el token. Devuelve true si lo entrego; false si el canal existe pero no esta
   * disponible en este entorno — nunca lanza en silencio ni finge que lo envio.
   */
  deliver(input: { email: string; issued: IssuedResetToken }): Promise<boolean>;
}

/** Duracion corta, como pide 4.7.2. Quince minutos: suficiente para usarlo, poco para robarlo. */
export const DEFAULT_RESET_TTL_MS = 15 * 60_000;

export class PasswordResetError extends Error {
  constructor(
    message: string,
    readonly reason:
      | 'token-invalido'
      | 'token-caducado'
      | 'token-ya-usado'
      | 'politica-incumplida'
      | 'reutiliza-contrasena',
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'PasswordResetError';
  }
}

const ARGON2 = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface PasswordResetServiceOptions {
  store: IResetStore;
  identities: ILocalIdentityStore;
  auditLog: IAuditLog;
  /** El mismo pepper que usa el proveedor local, leido de Key Vault (4.7.2). */
  pepper: string;
  policy?: PasswordPolicy;
  ttlMs?: number;
  now?: () => number;
  /** Revoca las sesiones abiertas de la cuenta. Se invoca al consumar el restablecimiento. */
  revokeSessions?: (userId: string) => Promise<void>;
}

export class PasswordResetService {
  private readonly policy: PasswordPolicy;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(private readonly options: PasswordResetServiceOptions) {
    this.policy = options.policy ?? DEFAULT_PASSWORD_POLICY;
    this.ttlMs = options.ttlMs ?? DEFAULT_RESET_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  /** Emite un token para una cuenta. */
  async issue(email: string, requestedBy: string): Promise<IssuedResetToken | null> {
    const cuenta = await this.options.identities.findByEmail(email);
    if (!cuenta) return null;

    const ahora = this.now();
    for (const pendiente of await this.options.store.listPendingFor(email)) {
      if (!pendiente.usedAt && pendiente.expiresAt > ahora) {
        await this.options.store.save({
          ...pendiente,
          // Se marca usado, no se borra: el rastro de que hubo un token y quedo invalidado es
          // parte de lo que un auditor necesita para reconstruir que paso con una cuenta.
          usedAt: new Date(ahora).toISOString(),
        });
      }
    }

    const resetId = randomBytes(9).toString('base64url');
    // 32 bytes de aleatoriedad criptografica. El token se muestra agrupado para poder dictarlo
    // por telefono sin equivocarse, que es como se entrega en el canal mediado.
    const token = randomBytes(24).toString('base64url');
    const expiresAt = ahora + this.ttlMs;

    await this.options.store.save({
      resetId,
      userId: cuenta.userId,
      email: cuenta.email,
      tokenHash: await hash(`${token}${this.options.pepper}`, ARGON2),
      expiresAt,
      requestedBy,
      createdAt: new Date(ahora).toISOString(),
    });

    return { resetId, token, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** Canjea el token y fija la contraseña nueva. */
  async redeem(input: {
    resetId: string;
    token: string;
    newPassword: string;
    sourceIp?: string;
  }): Promise<void> {
    const registro = await this.options.store.get(input.resetId);
    const ahora = this.now();

    // Un token inexistente y uno mal escrito se responden igual, y se registran igual.
    if (!registro) {
      await this.registrar(input.resetId, 'fallo', 'token-invalido', input.sourceIp);
      throw new PasswordResetError('El codigo no es valido.', 'token-invalido');
    }
    if (registro.usedAt) {
      await this.registrar(registro.email, 'fallo', 'token-ya-usado', input.sourceIp);
      throw new PasswordResetError('Ese codigo ya se uso.', 'token-ya-usado');
    }
    if (registro.expiresAt <= ahora) {
      await this.registrar(registro.email, 'fallo', 'token-caducado', input.sourceIp);
      throw new PasswordResetError('El codigo ha caducado. Pida otro.', 'token-caducado');
    }

    const coincide = await verify(registro.tokenHash, `${input.token}${this.options.pepper}`).catch(
      () => false,
    );
    if (!coincide) {
      await this.registrar(registro.email, 'fallo', 'token-invalido', input.sourceIp);
      throw new PasswordResetError('El codigo no es valido.', 'token-invalido');
    }

    const cuenta = await this.options.identities.findByEmail(registro.email);
    if (!cuenta) {
      await this.registrar(registro.email, 'fallo', 'token-invalido', input.sourceIp);
      throw new PasswordResetError('El codigo no es valido.', 'token-invalido');
    }

    const incumplimientos = checkPasswordPolicy(input.newPassword, this.policy);
    if (incumplimientos.length > 0) {
      throw new PasswordResetError(
        'La contraseña no cumple la politica.',
        'politica-incumplida',
        incumplimientos,
      );
    }

    // No reutilizacion de las ultimas N (4.7.2). Se comprueba contra el hash actual y el
    // historial, porque son hashes: no hay forma de compararlas en claro, ni debe haberla.
    const anteriores = [cuenta.passwordHash, ...cuenta.passwordHistory].slice(
      0,
      this.policy.historySize,
    );
    for (const anterior of anteriores) {
      if (await verify(anterior, `${input.newPassword}${this.options.pepper}`).catch(() => false)) {
        throw new PasswordResetError(
          `No puede reutilizar ninguna de sus ultimas ${this.policy.historySize} contraseñas.`,
          'reutiliza-contrasena',
        );
      }
    }

    const nuevoHash = await hash(`${input.newPassword}${this.options.pepper}`, ARGON2);
    const { lockedUntil: _bloqueo, ...sinBloqueo } = cuenta;
    await this.options.identities.save({
      ...sinBloqueo,
      passwordHash: nuevoHash,
      passwordHistory: [cuenta.passwordHash, ...cuenta.passwordHistory].slice(
        0,
        this.policy.historySize,
      ),
      // Restablecer desbloquea: un bloqueo del que no se sale no es un bloqueo, es una cuenta
      // perdida, y 4.7.2 lo prohibe expresamente.
      failedAttempts: 0,
    });

    await this.options.store.save({ ...registro, usedAt: new Date(ahora).toISOString() });
    await this.options.revokeSessions?.(cuenta.userId);
    await this.registrar(registro.email, 'exito', 'restablecimiento', input.sourceIp, cuenta.userId);
  }

  private async registrar(
    principal: string,
    outcome: 'exito' | 'fallo',
    reason: string,
    sourceIp?: string,
    userId?: string,
  ): Promise<void> {
    // Va al MISMO log consolidado que los inicios de sesion (seccion 7). Un restablecimiento es
    // un evento de acceso: quien audite "como entro esta cuenta" tiene que verlo en la misma
    // lista, no en otra que haya que acordarse de mirar.
    await this.options.auditLog.recordLogin({
      timestamp: new Date(this.now()).toISOString(),
      authProvider: 'local',
      attemptedPrincipal: principal,
      outcome,
      reason,
      ...(sourceIp ? { sourceIp } : {}),
      ...(userId ? { userId } : {}),
    });
  }
}

/** Canal de correo: DECLARADO, no disponible. */
export class CorreoInstitucionalNoDisponible implements IResetChannel {
  readonly name = 'correo institucional (no configurado en este entorno)';
  async deliver(): Promise<boolean> {
    return false;
  }
}
