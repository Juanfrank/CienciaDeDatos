import { randomBytes } from 'node:crypto';
import { Algorithm, hash } from '@node-rs/argon2';
import { roleInTeam } from '@app/access-control';
import { credentialsStore, localesAccounts, mailUser } from './identity';
import { governance } from './governance';
import { changeRecord } from './audit';

/**
 * Crear el PRIMER Administrador de un despliegue — seccion 4.7.2.
 *
 * Cerrar la siembra de demostracion fue lo correcto —lo que sembraba era una clave publica para
 * toda la institucion— pero dejo un despliegue sin la variable SIN NINGUNA cuenta local. Sin esto
 * no hay forma de entrar por primera vez, y eso bloquea el despliegue entero.
 *
 * Es un COMANDO de operacion, no una ruta HTTP, y la diferencia es el punto entero: una ruta de
 * arranque es una puerta que queda abierta para siempre y de la que hay que acordarse de cerrar.
 * Un comando solo lo ejecuta quien ya esta dentro de la maquina, que es exactamente la autoridad
 * que hace falta para conceder el primer acceso.
 *
 * Y se niega a correr si ya existe ALGUNA credencial local. No es una comprobacion de cortesia:
 * sin ella, este comando seria una forma de crear administradores en una institucion que ya
 * funciona, sin pasar por el gobierno ni dejar rastro de quien lo pidio.
 */

export interface PrimerAdministrador {
  userId: string;
  email: string;
  /** La contrasena en claro. Se ensena UNA vez y no se guarda en ninguna parte. */
  clave: string;
  /** El secreto TOTP, para darlo de alta en la aplicacion de segundo factor. */
  totp: string;
}

export class SinPoderCrearlo extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SinPoderCrearlo';
  }
}

/**
 * Una clave que nadie ha elegido.
 *
 * De `randomBytes` y no de `Math.random`, y en base64url para que se pueda dictar por telefono sin
 * confundir caracteres: es lo que va a pasar la primera vez, porque no hay correo configurado
 * todavia —eso es 1.1, y sigue bloqueado.
 */
const claveAlAzar = (): string => randomBytes(24).toString('base64url');

/**
 * El secreto TOTP, en base32, que es lo que leen las aplicaciones de segundo factor.
 *
 * Se genera aqui y no se reutiliza el de demostracion: ese es publico y esta en el repositorio.
 */
const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const secretoTotp = (): string =>
  [...randomBytes(20)].map((b) => ALFABETO_BASE32[b % 32]).join('');

/**
 * Crea la unica cuenta local de un despliegue nuevo.
 *
 * `userId` tiene que ser alguien que YA figure en el gobierno con rol de Administrador: este
 * comando concede el ACCESO, no el rol. Conceder las dos cosas a la vez convertiria un comando de
 * arranque en una forma de fabricar autoridad, y quien administra la maquina no es necesariamente
 * quien decide quien gobierna la institucion.
 */
export async function crearPrimerAdministrador(input: {
  userId: string;
  pepper: string;
}): Promise<PrimerAdministrador> {
  const existentes = await localesAccounts();
  if (existentes.length > 0) {
    throw new SinPoderCrearlo(
      `Ya hay ${existentes.length} cuenta(s) local(es). Este comando solo sirve para arrancar un ` +
        'despliegue sin ninguna. Para dar acceso a alguien mas, use el panel de administracion; ' +
        'para recuperar el acceso perdido, el procedimiento de acceso de emergencia.',
    );
  }

  const usuario = (await governance.listUsers()).find((u) => u.userId === input.userId);
  if (!usuario) {
    throw new SinPoderCrearlo(
      `El gobierno no tiene ningun usuario '${input.userId}'. Este comando concede el acceso a ` +
        'quien ya administra, no crea el rol.',
    );
  }

  const administra = (await governance.listTeams()).some(
    (equipo) => roleInTeam(equipo, input.userId) === 'administrador',
  );
  if (!administra) {
    throw new SinPoderCrearlo(
      `'${input.userId}' no es Administrador en ningun equipo. Darle una contrasena no le daria ` +
        'el panel, y dejaria una cuenta local que nadie puede usar para lo que hace falta.',
    );
  }

  const clave = claveAlAzar();
  const totp = secretoTotp();
  const email = mailUser(input.userId);

  await credentialsStore.save({
    userId: input.userId,
    email,
    passwordHash: await hash(`${clave}${input.pepper}`, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }),
    passwordHistory: [],
    // TOTP obligatorio: 4.7.2 lo exige para toda cuenta local, porque no heredan el MFA
    // centralizado de Azure AD. La primera cuenta menos que ninguna puede saltarselo.
    totpSecret: totp,
    failedAttempts: 0,
    emailVerified: true,
  });

  /*
   * Consta en el registro, con el sistema como actor.
   *
   * No hay una persona identificada que lo pidiera —todavia no hay nadie que pueda entrar—, y
   * atribuirselo al propio administrador que se esta creando diria que se concedio el acceso a si
   * mismo, que es justo lo que no paso.
   */
  await changeRecord({
    actorId: 'sistema',
    entityType: 'user-grant',
    entityId: input.userId,
    action: 'create',
    after: { cuentaLocal: email, motivo: 'arranque del despliegue' },
  });

  return { userId: input.userId, email, clave, totp };
}
