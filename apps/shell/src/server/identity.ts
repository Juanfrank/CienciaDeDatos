import { hash, Algorithm } from '@node-rs/argon2';
import {
  CorreoInstitucionalNoDisponible,
  LocalIdentityProvider,
  PasswordResetService,
  SessionService,
  type AppSession,
  type DirectoryEntry,
  type IAuditLog,
  type ILocalIdentityStore,
  type IPrincipalDirectory,
  type IResetChannel,
  type IResetStore,
  type ISessionStore,
  type LocalCredentialRecord,
  type LoginAuditEvent,
  type ResetRecord,
} from '@app/auth';
import { borrar, escribir, leer, readList } from './almacenCompartido';
import { CLAVE_DEMO, SECRETO_TOTP_DEMO, correoAUsuario, usuarioACorreo } from './credencialesDemo';
import { gobierno } from './gobierno';

export {
  CLAVE_DEMO,
  SECRETO_TOTP_DEMO,
  codigoTotpDe,
  correoAUsuario,
  usuarioACorreo,
} from './credencialesDemo';

/** Cableado de la autenticacion — seccion 4.7. */

const CLAVE_CREDENCIAL = (email: string) => `auth:credencial:${email.toLowerCase()}`;
const KEY_SESSION = (id: string) => `auth:sesion:${id}`;
const CLAVE_SESIONES_DE = (userId: string) => `auth:sesiones-de:${userId}`;
const CLAVE_AUDITORIA_LOGIN = 'auth:auditoria-login';
const CLAVE_SEMBRADO = 'auth:credenciales-sembradas';

/** Pimienta de aplicacion. */
function pimienta(): string {
  const configurada = process.env['AUTH_PEPPER'];
  if (configurada) return configurada;

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'AUTH_PEPPER no esta configurada. En produccion la pimienta se lee de Key Vault (4.7.2); ' +
        'arrancar con el valor de desarrollo dejaria todos los hashes con una pimienta publica.',
    );
  }
  return 'pimienta-de-desarrollo-no-usar-en-produccion';
}

class AlmacenDeCredenciales implements ILocalIdentityStore {
  async findByEmail(email: string): Promise<LocalCredentialRecord | null> {
    return (await leer<LocalCredentialRecord>(CLAVE_CREDENCIAL(email))) ?? null;
  }

  async save(record: LocalCredentialRecord): Promise<void> {
    await escribir(CLAVE_CREDENCIAL(record.email), record);
  }
}

class AlmacenDeSesiones implements ISessionStore {
  async create(session: AppSession): Promise<void> {
    await escribir(KEY_SESSION(session.sessionId), session);

    const indice = await readList<string>(CLAVE_SESIONES_DE(session.userId));
    if (!indice.includes(session.sessionId)) {
      await escribir(CLAVE_SESIONES_DE(session.userId), [session.sessionId, ...indice]);
    }
  }
  async get(sessionId: string): Promise<AppSession | null> {
    return (await leer<AppSession>(KEY_SESSION(sessionId))) ?? null;
  }
  async update(session: AppSession): Promise<void> {
    await escribir(KEY_SESSION(session.sessionId), session);
  }
  async delete(sessionId: string): Promise<void> {
    const sesion = await this.get(sessionId);
    await borrar(KEY_SESSION(sessionId));
    if (sesion) {
      const indice = await readList<string>(CLAVE_SESIONES_DE(sesion.userId));
      await escribir(
        CLAVE_SESIONES_DE(sesion.userId),
        indice.filter((id) => id !== sessionId),
      );
    }
  }

  /**
   * Un indice por persona, porque el almacen compartido es de clave-valor y no se puede
   * recorrer. En la base de identidad esto es un `DELETE ... WHERE userId = ?` y el indice
   * desaparece; aqui hay que mantenerlo, y por eso `create` y `delete` lo tocan.
   */
  async deleteAllFor(userId: string): Promise<void> {
    for (const id of await readList<string>(CLAVE_SESIONES_DE(userId))) {
      await borrar(KEY_SESSION(id));
    }
    await escribir(CLAVE_SESIONES_DE(userId), []);
  }
}

/** Cuantos intentos de inicio de sesion se conservan. */
const MAX_AUDIT = 200;

class AuditoriaDeLogin implements IAuditLog {
  async recordLogin(event: LoginAuditEvent): Promise<void> {
    const actuales = await readList<LoginAuditEvent>(CLAVE_AUDITORIA_LOGIN);
    await escribir(CLAVE_AUDITORIA_LOGIN, [event, ...actuales].slice(0, MAX_AUDIT));
  }
}

export const listarAuditoriaDeLogin = (): Promise<LoginAuditEvent[]> =>
  readList<LoginAuditEvent>(CLAVE_AUDITORIA_LOGIN);

/** Directorio institucional. */
class DirectorioDeGobierno implements IPrincipalDirectory {
  async lookup(userPrincipalName: string): Promise<DirectoryEntry | null> {
    const user = correoAUsuario(userPrincipalName);
    const existe = await gobierno.getUser(user);
    if (!existe) return null;

    const equipos = await gobierno.listTeams();
    const roles = [
      ...new Set(
        equipos.flatMap((t) =>
          t.members.filter((m) => m.userId === user).map((m) => m.role),
        ),
      ),
    ];

    return { userId: user, displayName: user, roles, securityContext: {} };
  }
}

export const almacenDeCredenciales = new AlmacenDeCredenciales();
export const auditoriaDeLogin = new AuditoriaDeLogin();

export const sesiones = new SessionService({ store: new AlmacenDeSesiones() });

/** El proveedor se construye PEREZOSAMENTE, en el primer inicio de sesion. */
let proveedorMemorizado: LocalIdentityProvider | undefined;

export function proveedorLocal(): LocalIdentityProvider {
  proveedorMemorizado ??= new LocalIdentityProvider({
    store: almacenDeCredenciales,
    directory: new DirectorioDeGobierno(),
    auditLog: auditoriaDeLogin,
    pepper: pimienta(),
  });
  return proveedorMemorizado;
}

/** Siembra las credenciales locales la primera vez. */
export async function asegurarCredenciales(): Promise<void> {
  if (await leer<boolean>(CLAVE_SEMBRADO)) return;

  const usuarios = await gobierno.listUsers();
  for (const user of usuarios) {
    const email = usuarioACorreo(user.userId);
    if (await almacenDeCredenciales.findByEmail(email)) continue;

    await almacenDeCredenciales.save({
      userId: user.userId,
      email,
      passwordHash: await hash(`${CLAVE_DEMO}${pimienta()}`, {
        algorithm: Algorithm.Argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
      passwordHistory: [],
      // TOTP obligatorio: 4.7.2 lo exige para toda cuenta local, porque no heredan el MFA
      // centralizado de Azure AD. Sembrarlas sin el dejaria el hueco que esa seccion cierra.
      totpSecret: SECRETO_TOTP_DEMO,
      failedAttempts: 0,
      emailVerified: true,
    });
  }

  await escribir(CLAVE_SEMBRADO, true);
}

/** Azure AD: declarado, no disponible. */
export const AZURE_AD_DISPONIBLE = Boolean(process.env['AZURE_AD_TENANT_ID']);

/** Restablecimiento de contraseña — seccion 4.7.2. */
const CLAVE_RESET = (resetId: string) => `auth:reset:${resetId}`;
const CLAVE_RESET_INDICE = (email: string) => `auth:reset-indice:${email.toLowerCase()}`;

class AlmacenDeRestablecimientos implements IResetStore {
  async save(record: ResetRecord): Promise<void> {
    await escribir(CLAVE_RESET(record.resetId), record);

    const indice = await readList<string>(CLAVE_RESET_INDICE(record.email));
    if (!indice.includes(record.resetId)) {
      // Se conservan los ultimos veinte por cuenta. El indice existe para poder invalidar los
      // vivos al emitir uno nuevo; guardarlos todos para siempre no aporta nada que la auditoria
      // de acceso no tenga ya.
      await escribir(CLAVE_RESET_INDICE(record.email), [record.resetId, ...indice].slice(0, 20));
    }
  }

  async get(resetId: string): Promise<ResetRecord | null> {
    return (await leer<ResetRecord>(CLAVE_RESET(resetId))) ?? null;
  }

  async listPendingFor(email: string): Promise<ResetRecord[]> {
    const ids = await readList<string>(CLAVE_RESET_INDICE(email));
    const registros = await Promise.all(ids.map((id) => this.get(id)));
    return registros.filter((r): r is ResetRecord => r !== null);
  }
}

export const restablecimientos = new PasswordResetService({
  store: new AlmacenDeRestablecimientos(),
  identities: almacenDeCredenciales,
  auditLog: auditoriaDeLogin,
  // Perezosa por lo mismo que el proveedor: `next build` no debe exigir el secreto de produccion.
  get pepper() {
    return pimienta();
  },
  revokeSessions: async (userId) => {
    await sesiones.revokeAllFor(userId);
  },
});

/** Canal de entrega disponible en este entorno. */
export const CORREO_DISPONIBLE = Boolean(process.env['SMTP_HOST']);
export const canalDeRestablecimiento: IResetChannel = new CorreoInstitucionalNoDisponible();

/** Desbloqueo de una cuenta local, sin cambiar la contraseña. */
export async function unlockAccount(email: string): Promise<boolean> {
  const cuenta = await almacenDeCredenciales.findByEmail(email);
  if (!cuenta) return false;

  const { lockedUntil: _bloqueo, ...sinBloqueo } = cuenta;
  await almacenDeCredenciales.save({ ...sinBloqueo, failedAttempts: 0 });
  return true;
}

/** Estado de una cuenta local, para la superficie de administracion de 4.7.2. */
export interface EstadoDeCuentaLocal {
  userId: string;
  email: string;
  bloqueada: boolean;
  bloqueadaHasta?: string;
  intentosFallidos: number;
  tieneSegundoFactor: boolean;
}

/** Cuentas locales existentes y por que. */
export async function cuentasLocales(): Promise<EstadoDeCuentaLocal[]> {
  const ahora = Date.now();
  const usuarios = await gobierno.listUsers();
  const cuentas: EstadoDeCuentaLocal[] = [];

  for (const user of usuarios) {
    const registro = await almacenDeCredenciales.findByEmail(usuarioACorreo(user.userId));
    if (!registro) continue;

    cuentas.push({
      userId: registro.userId,
      email: registro.email,
      bloqueada: (registro.lockedUntil ?? 0) > ahora,
      ...(registro.lockedUntil ? { bloqueadaHasta: new Date(registro.lockedUntil).toISOString() } : {}),
      intentosFallidos: registro.failedAttempts,
      tieneSegundoFactor: Boolean(registro.totpSecret),
    });
  }

  return cuentas;
}
