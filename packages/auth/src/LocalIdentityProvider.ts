import { Algorithm, hash, verify } from '@node-rs/argon2';
import { TOTP } from 'otpauth';
import {
  type AuthenticatedPrincipal,
  AuthenticationError,
  type IIdentityProvider,
  type IPrincipalDirectory,
  assemblePrincipal,
} from './IIdentityProvider';
import {
  DEFAULT_LOCKOUT_POLICY,
  DEFAULT_PASSWORD_POLICY,
  type LockoutPolicy,
  type PasswordPolicy,
  checkPasswordPolicy,
  lockDurationMs,
} from './passwordPolicy';
import type { IAuditLog, ILocalIdentityStore, LocalCredentialRecord } from './stores';

/** Proveedor de identidad local — seccion 4.7.2. */

export interface LocalCredentials {
  email: string;
  password: string;
  /** Codigo TOTP. Obligatorio si la cuenta tiene segundo factor configurado. */
  totpCode?: string;
  sourceIp?: string;
}

export interface LocalIdentityProviderOptions {
  store: ILocalIdentityStore;
  directory: IPrincipalDirectory;
  auditLog: IAuditLog;
  /**
   * Pepper a nivel de aplicacion, leido de Azure Key Vault — NUNCA del propio registro del
   * usuario. Un volcado de la base de identidad, por si solo, no permite atacar los hashes.
   */
  pepper: string;
  passwordPolicy?: PasswordPolicy;
  lockoutPolicy?: LockoutPolicy;
  /** Reloj inyectable, para poder probar el bloqueo y su expiracion sin esperar. */
  now?: () => number;
}

/** Parametros Argon2id. m=19456 KiB, t=2, p=1: la linea base recomendada por OWASP. */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class LocalIdentityProvider implements IIdentityProvider {
  private readonly store: ILocalIdentityStore;
  private readonly directory: IPrincipalDirectory;
  private readonly auditLog: IAuditLog;
  private readonly pepper: string;
  private readonly passwordPolicy: PasswordPolicy;
  private readonly lockoutPolicy: LockoutPolicy;
  private readonly now: () => number;

  constructor(options: LocalIdentityProviderOptions) {
    if (!options.pepper) {
      throw new Error(
        'LocalIdentityProvider requiere un pepper de aplicacion (Azure Key Vault, seccion 4.7.2).',
      );
    }
    this.store = options.store;
    this.directory = options.directory;
    this.auditLog = options.auditLog;
    this.pepper = options.pepper;
    this.passwordPolicy = options.passwordPolicy ?? DEFAULT_PASSWORD_POLICY;
    this.lockoutPolicy = options.lockoutPolicy ?? DEFAULT_LOCKOUT_POLICY;
    this.now = options.now ?? Date.now;
  }

  /** El pepper se combina con la contraseña antes de hashear, nunca se guarda junto al hash. */
  private season(password: string): string {
    return `${password}${this.pepper}`;
  }

  async hashPassword(password: string): Promise<string> {
    return hash(this.season(password), ARGON2_OPTIONS);
  }

  /** Valida una contraseña nueva contra la politica y el historial. */
  async validateNewPassword(
    password: string,
    record?: Pick<LocalCredentialRecord, 'passwordHash' | 'passwordHistory'>,
  ): Promise<{ ok: boolean; violations: { rule: string; message: string }[] }> {
    const violations: { rule: string; message: string }[] = checkPasswordPolicy(
      password,
      this.passwordPolicy,
    );

    if (record) {
      const anteriores = [record.passwordHash, ...record.passwordHistory].slice(
        0,
        this.passwordPolicy.historySize,
      );
      for (const anterior of anteriores) {
        if (await this.safeVerify(anterior, password)) {
          violations.push({
            rule: 'historyReuse',
            message: `No puede reutilizar ninguna de las ultimas ${this.passwordPolicy.historySize} contraseñas.`,
          });
          break;
        }
      }
    }

    return { ok: violations.length === 0, violations };
  }

  /** Registra una contraseña nueva, desplazando el historial. */
  async setPassword(record: LocalCredentialRecord, password: string): Promise<LocalCredentialRecord> {
    const { ok, violations } = await this.validateNewPassword(password, record);
    if (!ok) throw new Error(`La contraseña no cumple la politica: ${violations.map((v) => v.message).join(' ')}`);

    const actualizado: LocalCredentialRecord = {
      ...record,
      passwordHash: await this.hashPassword(password),
      passwordHistory: [record.passwordHash, ...record.passwordHistory].slice(
        0,
        this.passwordPolicy.historySize,
      ),
      failedAttempts: 0,
    };
    delete actualizado.lockedUntil;
    await this.store.save(actualizado);
    return actualizado;
  }

  private async safeVerify(storedHash: string, password: string): Promise<boolean> {
    try {
      return await verify(storedHash, this.season(password));
    } catch {
      // Un hash corrupto o de otro algoritmo no debe distinguirse de una contraseña erronea.
      return false;
    }
  }

  async authenticate(credentials: unknown): Promise<AuthenticatedPrincipal> {
    const { email, password, totpCode, sourceIp } = credentials as LocalCredentials;
    const registro = await this.store.findByEmail(email);

    // Cuenta inexistente: mismo error y mismo camino que una contraseña erronea, para no
    // revelar que correos existen en el almacen local.
    if (!registro) {
      await this.audit(email, 'fallo', 'credenciales-invalidas', sourceIp);
      throw new AuthenticationError('Credenciales invalidas.', 'credenciales-invalidas');
    }

    if (registro.lockedUntil && registro.lockedUntil > this.now()) {
      await this.audit(email, 'fallo', 'cuenta-bloqueada', sourceIp, registro.userId);
      throw new AuthenticationError(
        'La cuenta esta temporalmente bloqueada por intentos fallidos.',
        'cuenta-bloqueada',
      );
    }

    if (!(await this.safeVerify(registro.passwordHash, password))) {
      await this.registerFailure(registro);
      await this.audit(email, 'fallo', 'credenciales-invalidas', sourceIp, registro.userId);
      throw new AuthenticationError('Credenciales invalidas.', 'credenciales-invalidas');
    }

    // MFA obligatorio: la ausencia de la gobernanza centralizada de Azure AD se compensa aqui.
    if (registro.totpSecret) {
      if (!totpCode) {
        await this.audit(email, 'fallo', 'mfa-requerido', sourceIp, registro.userId);
        throw new AuthenticationError('Se requiere el codigo de segundo factor.', 'mfa-requerido');
      }
      if (!this.verifyTotp(registro.totpSecret, totpCode)) {
        await this.registerFailure(registro);
        await this.audit(email, 'fallo', 'mfa-invalido', sourceIp, registro.userId);
        throw new AuthenticationError('Codigo de segundo factor invalido.', 'mfa-invalido');
      }
    }

    // Roles y securityContext salen del MISMO directorio institucional que usa Azure AD.
    const entry = await this.directory.lookup(registro.email);
    if (!entry) {
      await this.audit(email, 'fallo', 'sin-identidad-institucional', sourceIp, registro.userId);
      throw new AuthenticationError(
        'La cuenta no tiene roles ni ambito asignados en el directorio.',
        'sin-identidad-institucional',
      );
    }

    const limpio: LocalCredentialRecord = { ...registro, failedAttempts: 0 };
    delete limpio.lockedUntil;
    await this.store.save(limpio);

    await this.audit(email, 'exito', undefined, sourceIp, registro.userId);
    return assemblePrincipal(entry, 'local', registro.email);
  }

  private verifyTotp(secret: string, code: string): boolean {
    const totp = new TOTP({ secret, algorithm: 'SHA1', digits: 6, period: 30 });
    // El TOTP se valida contra el MISMO reloj inyectado que usa el bloqueo. Usar el reloj
    // real aqui haria que el segundo factor y el backoff discreparan en las pruebas, y
    // —mas importante— impediria probar la tolerancia al desfase de reloj.
    // window: 1 tolera un paso (30 s) de desfase en cualquier direccion.
    return totp.validate({ token: code, window: 1, timestamp: this.now() }) !== null;
  }

  private async registerFailure(record: LocalCredentialRecord): Promise<void> {
    const failedAttempts = record.failedAttempts + 1;
    const duracion = lockDurationMs(failedAttempts, this.lockoutPolicy);
    await this.store.save({
      ...record,
      failedAttempts,
      ...(duracion > 0 ? { lockedUntil: this.now() + duracion } : {}),
    });
  }

  private async audit(
    attemptedPrincipal: string,
    outcome: 'exito' | 'fallo',
    reason?: string,
    sourceIp?: string,
    userId?: string,
  ): Promise<void> {
    await this.auditLog.recordLogin({
      timestamp: new Date(this.now()).toISOString(),
      authProvider: 'local',
      attemptedPrincipal,
      outcome,
      ...(reason ? { reason } : {}),
      ...(sourceIp ? { sourceIp } : {}),
      ...(userId ? { userId } : {}),
    });
  }
}
