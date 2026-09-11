import { hash, Algorithm } from '@node-rs/argon2';
import {
  LocalIdentityProvider,
  SessionService,
  type AppSession,
  type DirectoryEntry,
  type IAuditLog,
  type ILocalIdentityStore,
  type IPrincipalDirectory,
  type ISessionStore,
  type LocalCredentialRecord,
  type LoginAuditEvent,
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
  }
  async get(sessionId: string): Promise<AppSession | null> {
    return (await leer<AppSession>(CLAVE_SESION(sessionId))) ?? null;
  }
  async update(session: AppSession): Promise<void> {
    await escribir(CLAVE_SESION(session.sessionId), session);
  }
  async delete(sessionId: string): Promise<void> {
    await borrar(CLAVE_SESION(sessionId));
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
