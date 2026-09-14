import { Secret, TOTP } from 'otpauth';

/** Credenciales de demostracion y utilidades de correo institucional. */
export const DEMO_KEY = 'Demostracion-2026!';
export const SECRETO_TOTP_DEMO = 'JBSWY3DPEHPK3PXP';

/** Correo institucional -> identificador de usuario del gobierno. */
export const userMail = (mail: string): string =>
  (mail.split('@')[0] ?? mail).toLowerCase();

export const mailUser = (userId: string): string => `${userId}@poderjudicial.gob.do`;

export function totpCodeOf(secreto: string, ahora = new Date()): string {
  return new TOTP({ secret: Secret.fromBase32(secreto), digits: 6, period: 30 }).generate({
    timestamp: ahora.getTime(),
  });
}
