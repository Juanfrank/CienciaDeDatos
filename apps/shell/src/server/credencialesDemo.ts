import { Secret, TOTP } from 'otpauth';

/** Credenciales de demostracion y utilidades de correo institucional. */
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
