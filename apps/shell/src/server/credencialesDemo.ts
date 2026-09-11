import { Secret, TOTP } from 'otpauth';

/**
 * Credenciales de demostracion y utilidades de correo institucional.
 *
 * Van aparte de `identidad.ts` para que las pruebas de navegador puedan iniciar sesion de verdad
 * sin arrastrar consigo Argon2id, el gobierno y el almacen compartido. Importar el cableado
 * entero desde un fichero de Playwright funcionaria, pero ataria el arranque de las pruebas a
 * media aplicacion.
 *
 * Estas credenciales existen porque sin base de identidad no hay de donde sacar otras, y sin
 * credenciales no se puede comprobar el camino de autenticacion. Son deliberadamente evidentes:
 * en produccion el arranque falla antes de llegar a sembrarlas, porque la pimienta no viene de
 * Key Vault.
 */
export const CLAVE_DEMO = 'Demostracion-2026!';
export const SECRETO_TOTP_DEMO = 'JBSWY3DPEHPK3PXP';

/** Correo institucional -> identificador de usuario del gobierno. */
export const correoAUsuario = (correo: string): string =>
  (correo.split('@')[0] ?? correo).toLowerCase();

export const usuarioACorreo = (userId: string): string => `${userId}@poderjudicial.gob.do`;

export function codigoTotpDe(secreto: string, ahora = new Date()): string {
  return new TOTP({ secret: Secret.fromBase32(secreto), digits: 6, period: 30 }).generate({
    timestamp: ahora.getTime(),
  });
}
