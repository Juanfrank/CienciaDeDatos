import { hash, Algorithm } from '@node-rs/argon2';
import {
  InstitutionalMailNotAvailable,
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
import { borrar, mutar, write, leer, readList } from './almacenCompartido';
import { DEMO_KEY, SECRETO_TOTP_DEMO, userMail, mailUser } from './demoCredentials';
import { governance } from './governance';

export {
  DEMO_KEY,
  SECRETO_TOTP_DEMO,
  totpCodeOf,
  userMail,
  mailUser,
} from './demoCredentials';

/** Cableado de la autenticacion — seccion 4.7. */

const CREDENTIAL_KEY = (email: string) => `auth:credencial:${email.toLowerCase()}`;
const KEY_SESSION = (id: string) => `auth:sesion:${id}`;
const SESSIONS_KEY_OF = (userId: string) => `auth:sesiones-de:${userId}`;
const KEY_AUDIT_LOGIN = 'auth:auditoria-login';
const SEEDED_KEY = 'auth:credenciales-sembradas';

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

class CredentialsStore implements ILocalIdentityStore {
  async findByEmail(email: string): Promise<LocalCredentialRecord | null> {
    return (await leer<LocalCredentialRecord>(CREDENTIAL_KEY(email))) ?? null;
  }

  async save(record: LocalCredentialRecord): Promise<void> {
    await write(CREDENTIAL_KEY(record.email), record);
  }
}

class SessionsStore implements ISessionStore {
  async create(session: AppSession): Promise<void> {
    await write(KEY_SESSION(session.sessionId), session);

    // El indice se toca bajo turno. Dos inicios de sesion de la misma persona a la vez leian el
    // mismo indice y el segundo borraba el id del primero: la sesion seguia viva pero ya no
    // figuraba, y «cerrar sesion en todos los dispositivos» —que recorre este indice— la dejaba
    // abierta. Una revocacion que no revoca es peor que no tenerla.
    await mutar<string[]>(SESSIONS_KEY_OF(session.userId), (indice) =>
      (indice ?? []).includes(session.sessionId)
        ? (indice ?? [])
        : [session.sessionId, ...(indice ?? [])],
    );
  }
  async get(sessionId: string): Promise<AppSession | null> {
    return (await leer<AppSession>(KEY_SESSION(sessionId))) ?? null;
  }
  async update(session: AppSession): Promise<void> {
    await write(KEY_SESSION(session.sessionId), session);
  }
  async delete(sessionId: string): Promise<void> {
    const sesion = await this.get(sessionId);
    await borrar(KEY_SESSION(sessionId));
    if (sesion) {
      await mutar<string[]>(SESSIONS_KEY_OF(sesion.userId), (indice) =>
        (indice ?? []).filter((id) => id !== sessionId),
      );
    }
  }

  /**
   * Un indice por persona, porque el almacen compartido es de clave-valor y no se puede
   * recorrer. En la base de identidad esto es un `DELETE ... WHERE userId = ?` y el indice
   * desaparece; aqui hay que mantenerlo, y por eso `create` y `delete` lo tocan.
   */
  async deleteAllFor(userId: string): Promise<void> {
    for (const id of await readList<string>(SESSIONS_KEY_OF(userId))) {
      await borrar(KEY_SESSION(id));
    }
    await write(SESSIONS_KEY_OF(userId), []);
  }
}

/** Cuantos intentos de inicio de sesion se conservan. */
const MAX_AUDIT = 200;

class LoginAudit implements IAuditLog {
  async recordLogin(event: LoginAuditEvent): Promise<void> {
    // Bajo turno: los intentos fallidos llegan precisamente en rafaga, que es cuando el registro
    // hace falta. Leyendo y escribiendo por separado, de diez intentos simultaneos quedaba
    // anotado uno, y el rastro de un ataque se veria como un error de dedo.
    await mutar<LoginAuditEvent[]>(KEY_AUDIT_LOGIN, (actuales) =>
      [event, ...(actuales ?? [])].slice(0, MAX_AUDIT),
    );
  }
}

export const loginAuditList = (): Promise<LoginAuditEvent[]> =>
  readList<LoginAuditEvent>(KEY_AUDIT_LOGIN);

/** Directorio institucional. */
class GovernanceDirectory implements IPrincipalDirectory {
  async lookup(userPrincipalName: string): Promise<DirectoryEntry | null> {
    const user = userMail(userPrincipalName);
    const exists = await governance.getUser(user);
    if (!exists) return null;

    const equipos = await governance.listTeams();
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

export const credentialsStore = new CredentialsStore();
export const loginAudit = new LoginAudit();

export const sessions = new SessionService({ store: new SessionsStore() });

/** El proveedor se construye PEREZOSAMENTE, en el primer inicio de sesion. */
let memoizedProvider: LocalIdentityProvider | undefined;

export function localProvider(): LocalIdentityProvider {
  memoizedProvider ??= new LocalIdentityProvider({
    store: credentialsStore,
    directory: new GovernanceDirectory(),
    auditLog: loginAudit,
    pepper: pimienta(),
  });
  return memoizedProvider;
}

/**
 * Si este entorno puede sembrar credenciales de demostracion.
 *
 * Es una puerta EXPLICITA, no deducida. `NODE_ENV` no sirve: las pruebas de navegador arrancan
 * con `next start`, que es produccion, asi que mirarlo dejaria la siembra encendida justo donde
 * mas dano hace o apagada justo donde hace falta. Un despliegue real no lleva esta variable y la
 * siembra no ocurre nunca; quien la ponga esta diciendo «esto es una demostracion».
 */
const SIEMBRA_PERMITIDA = process.env['SEED_DEMO_CREDENTIALS'] === '1';

/**
 * Siembra las credenciales locales la primera vez.
 *
 * Lo que siembra es la MISMA contrasena y el MISMO secreto TOTP para todas las cuentas, y los dos
 * estan escritos en `demoCredentials.ts`, dentro del repositorio —el secreto es ademas el vector
 * de prueba publico de la RFC—. Sirven para abrir una demostracion; en un despliegue real dejarian
 * a la institucion entera, Administradores incluidos, con una clave y un segundo factor que
 * cualquiera puede leer.
 *
 * Antes esto se ejecutaba en CADA peticion de acceso sin ninguna condicion. Ahora hace falta
 * pedirlo con `SEED_DEMO_CREDENTIALS=1`.
 */
export async function asegurarCredenciales(): Promise<void> {
  if (!SIEMBRA_PERMITIDA) return;
  if (await leer<boolean>(SEEDED_KEY)) return;

  const usuarios = await governance.listUsers();
  for (const user of usuarios) {
    const email = mailUser(user.userId);
    if (await credentialsStore.findByEmail(email)) continue;

    await credentialsStore.save({
      userId: user.userId,
      email,
      passwordHash: await hash(`${DEMO_KEY}${pimienta()}`, {
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

  await write(SEEDED_KEY, true);
}

/** Azure AD: declarado, no disponible. */
export const AZURE_AD_AVAILABLE = Boolean(process.env['AZURE_AD_TENANT_ID']);

/** Restablecimiento de contraseña — seccion 4.7.2. */
const RESET_KEY = (resetId: string) => `auth:reset:${resetId}`;
const KEY_RESET_INDEX = (email: string) => `auth:reset-indice:${email.toLowerCase()}`;

class ResetsStore implements IResetStore {
  async save(record: ResetRecord): Promise<void> {
    await write(RESET_KEY(record.resetId), record);

    // Se conservan los ultimos veinte por cuenta. El indice existe para poder invalidar los
    // vivos al emitir uno nuevo; guardarlos todos para siempre no aporta nada que la auditoria
    // de acceso no tenga ya. Bajo turno, como el de sesiones: un id que no llegue al indice es
    // un enlace de restablecimiento que sigue valiendo despues de que se emita otro.
    await mutar<string[]>(KEY_RESET_INDEX(record.email), (indice) => {
      const actual = indice ?? [];
      return actual.includes(record.resetId)
        ? actual
        : [record.resetId, ...actual].slice(0, 20);
    });
  }

  async get(resetId: string): Promise<ResetRecord | null> {
    return (await leer<ResetRecord>(RESET_KEY(resetId))) ?? null;
  }

  async listPendingFor(email: string): Promise<ResetRecord[]> {
    const ids = await readList<string>(KEY_RESET_INDEX(email));
    const registros = await Promise.all(ids.map((id) => this.get(id)));
    return registros.filter((r): r is ResetRecord => r !== null);
  }
}

export const resets = new PasswordResetService({
  store: new ResetsStore(),
  identities: credentialsStore,
  auditLog: loginAudit,
  // Perezosa por lo mismo que el proveedor: `next build` no debe exigir el secreto de produccion.
  get pepper() {
    return pimienta();
  },
  revokeSessions: async (userId) => {
    await sessions.revokeAllFor(userId);
  },
});

/** Canal de entrega disponible en este entorno. */
export const AVAILABLE_MAIL = Boolean(process.env['SMTP_HOST']);
export const canalDeRestablecimiento: IResetChannel = new InstitutionalMailNotAvailable();

/** Desbloqueo de una cuenta local, sin cambiar la contraseña. */
export async function unlockAccount(email: string): Promise<boolean> {
  const cuenta = await credentialsStore.findByEmail(email);
  if (!cuenta) return false;

  const { lockedUntil: _bloqueo, ...sinBloqueo } = cuenta;
  await credentialsStore.save({ ...sinBloqueo, failedAttempts: 0 });
  return true;
}

/** Estado de una cuenta local, para la superficie de administracion de 4.7.2. */
export interface LocalAccountStatus {
  userId: string;
  email: string;
  bloqueada: boolean;
  bloqueadaHasta?: string;
  intentosFallidos: number;
  tieneSegundoFactor: boolean;
}

/** Cuentas locales existentes y por que. */
export async function localesAccounts(): Promise<LocalAccountStatus[]> {
  const ahora = Date.now();
  const usuarios = await governance.listUsers();
  const accounts: LocalAccountStatus[] = [];

  for (const user of usuarios) {
    const registro = await credentialsStore.findByEmail(mailUser(user.userId));
    if (!registro) continue;

    accounts.push({
      userId: registro.userId,
      email: registro.email,
      bloqueada: (registro.lockedUntil ?? 0) > ahora,
      ...(registro.lockedUntil ? { bloqueadaHasta: new Date(registro.lockedUntil).toISOString() } : {}),
      intentosFallidos: registro.failedAttempts,
      tieneSegundoFactor: Boolean(registro.totpSecret),
    });
  }

  return accounts;
}
