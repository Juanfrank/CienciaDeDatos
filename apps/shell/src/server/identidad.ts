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
import { borrar, escribir, leer, leerLista } from './almacenCompartido';
import { CLAVE_DEMO, SECRETO_TOTP_DEMO, correoAUsuario, usuarioACorreo } from './credencialesDemo';
import { gobierno } from './gobierno';

export {
  CLAVE_DEMO,
  SECRETO_TOTP_DEMO,
  codigoTotpDe,
  correoAUsuario,
  usuarioACorreo,
} from './credencialesDemo';

/**
 * Cableado de la autenticacion — seccion 4.7.
 *
 * El paquete `@app/auth` estaba completo y probado desde B.3 —Argon2id con pimienta, TOTP
 * obligatorio, bloqueo con backoff, los dos proveedores convergiendo en un mismo principal— y
 * el shell no lo usaba: la sesion se emitia sola con un usuario de demostracion. Esto es lo que
 * faltaba para que los criterios de la seccion 9 sobre autenticacion se puedan comprobar de
 * punta a punta y no solo argumentar por las pruebas del paquete.
 *
 * Los tres almacenes van al almacen COMPARTIDO, por lo mismo que el resto del estado: una
 * sesion que solo conoce una instancia se pierde al escalar. En produccion los tres viven en la
 * base de identidad (4.7.2, 6.7) y solo cambia el adaptador.
 */

const CLAVE_CREDENCIAL = (email: string) => `auth:credencial:${email.toLowerCase()}`;
const CLAVE_SESION = (id: string) => `auth:sesion:${id}`;
const CLAVE_SESIONES_DE = (userId: string) => `auth:sesiones-de:${userId}`;
const CLAVE_AUDITORIA_LOGIN = 'auth:auditoria-login';
const CLAVE_SEMBRADO = 'auth:credenciales-sembradas';

/**
 * Pimienta de aplicacion.
 *
 * En produccion sale de Key Vault y NUNCA del registro del usuario: un volcado de la base de
 * identidad, por si solo, no permite atacar los hashes. Aqui hay un valor de desarrollo fijo
 * —tiene que ser estable entre instancias o los hashes dejan de verificar— y el arranque FALLA
 * si no viene de configuracion fuera de desarrollo, en vez de usar el valor conocido en
 * produccion sin que nadie se entere.
 */
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
    await escribir(CLAVE_SESION(session.sessionId), session);

    const indice = await leerLista<string>(CLAVE_SESIONES_DE(session.userId));
    if (!indice.includes(session.sessionId)) {
      await escribir(CLAVE_SESIONES_DE(session.userId), [session.sessionId, ...indice]);
    }
  }
  async get(sessionId: string): Promise<AppSession | null> {
    return (await leer<AppSession>(CLAVE_SESION(sessionId))) ?? null;
  }
  async update(session: AppSession): Promise<void> {
    await escribir(CLAVE_SESION(session.sessionId), session);
  }
  async delete(sessionId: string): Promise<void> {
    const sesion = await this.get(sessionId);
    await borrar(CLAVE_SESION(sessionId));
    if (sesion) {
      const indice = await leerLista<string>(CLAVE_SESIONES_DE(sesion.userId));
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
    for (const id of await leerLista<string>(CLAVE_SESIONES_DE(userId))) {
      await borrar(CLAVE_SESION(id));
    }
    await escribir(CLAVE_SESIONES_DE(userId), []);
  }
}

/** Cuantos intentos de inicio de sesion se conservan. */
const MAXIMO_AUDITORIA = 200;

class AuditoriaDeLogin implements IAuditLog {
  async recordLogin(event: LoginAuditEvent): Promise<void> {
    const actuales = await leerLista<LoginAuditEvent>(CLAVE_AUDITORIA_LOGIN);
    await escribir(CLAVE_AUDITORIA_LOGIN, [event, ...actuales].slice(0, MAXIMO_AUDITORIA));
  }
}

export const listarAuditoriaDeLogin = (): Promise<LoginAuditEvent[]> =>
  leerLista<LoginAuditEvent>(CLAVE_AUDITORIA_LOGIN);

/**
 * Directorio institucional.
 *
 * Es la pieza de 4.7.3 que hace que los roles NO dependan de la puerta de entrada: los dos
 * proveedores preguntan aqui, y aqui se responde con el gobierno. Si un proveedor construyera
 * roles por su cuenta, entrar por Azure AD o en local daria accesos distintos.
 *
 * El `securityContext` va vacio a proposito: el ambito de datos lo resuelve `access-control` a
 * partir del equipo ACTIVO (4.10.4), y duplicarlo aqui daria dos fuentes de verdad para la
 * misma pregunta.
 */
class DirectorioDeGobierno implements IPrincipalDirectory {
  async lookup(userPrincipalName: string): Promise<DirectoryEntry | null> {
    const usuario = correoAUsuario(userPrincipalName);
    const existe = await gobierno.getUser(usuario);
    if (!existe) return null;

    const equipos = await gobierno.listTeams();
    const roles = [
      ...new Set(
        equipos.flatMap((t) =>
          t.members.filter((m) => m.userId === usuario).map((m) => m.role),
        ),
      ),
    ];

    return { userId: usuario, displayName: usuario, roles, securityContext: {} };
  }
}

export const almacenDeCredenciales = new AlmacenDeCredenciales();
export const auditoriaDeLogin = new AuditoriaDeLogin();

export const sesiones = new SessionService({ store: new AlmacenDeSesiones() });

/**
 * El proveedor se construye PEREZOSAMENTE, en el primer inicio de sesion.
 *
 * Construirlo al evaluar el modulo hacia que `pimienta()` corriera durante `next build`, que
 * tambien pone NODE_ENV=production: la construccion fallaba por falta de un secreto que solo
 * hace falta para autenticar. Construir no es ejecutar, y una aplicacion que no se puede
 * compilar sin los secretos de produccion obliga a tenerlos en la maquina de compilacion, que
 * es justo lo contrario de lo que pretende guardarlos en Key Vault.
 */
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

/**
 * Siembra las credenciales locales la primera vez.
 *
 * Es idempotente y perezosa: hashear con Argon2id cuesta cientos de milisegundos por cuenta, y
 * hacerlo en cada arranque penalizaria el inicio de todas las instancias para nada.
 */
export async function asegurarCredenciales(): Promise<void> {
  if (await leer<boolean>(CLAVE_SEMBRADO)) return;

  const usuarios = await gobierno.listUsers();
  for (const usuario of usuarios) {
    const email = usuarioACorreo(usuario.userId);
    if (await almacenDeCredenciales.findByEmail(email)) continue;

    await almacenDeCredenciales.save({
      userId: usuario.userId,
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

/**
 * Azure AD: declarado, no disponible.
 *
 * `AzureAdIdentityProvider` esta implementado y probado, pero necesita un tenant contra el que
 * validar tokens. Se reporta como no disponible en vez de simular un inicio de sesion que
 * pareceria funcionar — el mismo criterio que siguen los conectores de datos pendientes.
 */
export const AZURE_AD_DISPONIBLE = Boolean(process.env['AZURE_AD_TENANT_ID']);

/**
 * Restablecimiento de contraseña — seccion 4.7.2.
 *
 * El canal de correo institucional NO existe en este entorno. Lo que se implementa es el flujo
 * entero —token de un solo uso, hasheado, con expiracion corta, que desbloquea la cuenta y
 * revoca las sesiones al canjearse— y el canal queda como puerto con una unica implementacion:
 * la mediada por un Administrador, que verifica la identidad por una via de la que el responde y
 * entrega el codigo en mano o por telefono.
 *
 * Lo que NO se hace es inventar un sustituto que parezca correo. Ver docs/hoja-de-ruta.md.
 */
const CLAVE_RESET = (resetId: string) => `auth:reset:${resetId}`;
const CLAVE_RESET_INDICE = (email: string) => `auth:reset-indice:${email.toLowerCase()}`;

class AlmacenDeRestablecimientos implements IResetStore {
  async save(record: ResetRecord): Promise<void> {
    await escribir(CLAVE_RESET(record.resetId), record);

    const indice = await leerLista<string>(CLAVE_RESET_INDICE(record.email));
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
    const ids = await leerLista<string>(CLAVE_RESET_INDICE(email));
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

/**
 * Canal de entrega disponible en este entorno.
 *
 * `CorreoInstitucionalNoDisponible` esta declarado en el paquete y devuelve false. Aqui se
 * escoge cual se usa, con la misma regla que los conectores de datos pendientes: si el canal
 * institucional estuviera configurado, seria ese; como no lo esta, el flujo es mediado y la
 * interfaz lo dice en vez de simular un envio.
 */
export const CORREO_DISPONIBLE = Boolean(process.env['SMTP_HOST']);
export const canalDeRestablecimiento: IResetChannel = new CorreoInstitucionalNoDisponible();

/**
 * Desbloqueo de una cuenta local, sin cambiar la contraseña.
 *
 * Es la otra mitad de "no bloqueo indefinido sin via de recuperacion" (4.7.2): quien se
 * equivoco cinco veces y ya recuerda su contraseña no necesita una nueva, necesita que el
 * contador se ponga a cero. Obligarle a restablecerla convertiria un error de dedos en un
 * cambio de credencial, que es peor: mas contraseñas nuevas, mas apuntadas en un papel.
 */
export async function desbloquearCuenta(email: string): Promise<boolean> {
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

/**
 * Cuentas locales existentes y por que.
 *
 * 4.7.2 lo pide expresamente: "Documenta y haz visible en el panel de administracion cuantas
 * cuentas locales existen y por que". Son la excepcion, no la via por defecto, y una lista que
 * crece sin que nadie la mire es como dejan de ser la excepcion.
 */
export async function cuentasLocales(): Promise<EstadoDeCuentaLocal[]> {
  const ahora = Date.now();
  const usuarios = await gobierno.listUsers();
  const cuentas: EstadoDeCuentaLocal[] = [];

  for (const usuario of usuarios) {
    const registro = await almacenDeCredenciales.findByEmail(usuarioACorreo(usuario.userId));
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
