/**
 * Politicas de cuenta para credenciales locales — seccion 4.7.2.
 *
 * Configurable, como exige el documento: longitud minima y no reutilizacion de las ultimas N.
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  /** No reutilizacion de las ultimas N contraseñas. */
  historySize: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
  historySize: 5,
};

export interface PolicyViolation {
  rule: keyof PasswordPolicy | 'historyReuse';
  message: string;
}

export function checkPasswordPolicy(password: string, policy: PasswordPolicy): PolicyViolation[] {
  const fallos: PolicyViolation[] = [];
  if (password.length < policy.minLength) {
    fallos.push({ rule: 'minLength', message: `Debe tener al menos ${policy.minLength} caracteres.` });
  }
  if (policy.requireUppercase && !/[A-ZÁÉÍÓÚÑ]/.test(password)) {
    fallos.push({ rule: 'requireUppercase', message: 'Debe incluir al menos una mayuscula.' });
  }
  if (policy.requireLowercase && !/[a-záéíóúñ]/.test(password)) {
    fallos.push({ rule: 'requireLowercase', message: 'Debe incluir al menos una minuscula.' });
  }
  if (policy.requireDigit && !/\d/.test(password)) {
    fallos.push({ rule: 'requireDigit', message: 'Debe incluir al menos un digito.' });
  }
  if (policy.requireSymbol && !/[^\w\sÁÉÍÓÚÑáéíóúñ]/.test(password)) {
    fallos.push({ rule: 'requireSymbol', message: 'Debe incluir al menos un simbolo.' });
  }
  return fallos;
}

/**
 * Bloqueo de cuenta con backoff progresivo — nunca bloqueo indefinido sin via de recuperacion.
 *
 * Es independiente del rate limiting del endpoint de login, que vive en Front Door/App Service
 * y mitiga la fuerza bruta DISTRIBUIDA. Este bloqueo protege una cuenta concreta; aquel protege
 * el endpoint. El documento pide los dos, y uno no sustituye al otro.
 */
export interface LockoutPolicy {
  /** Intentos fallidos antes del primer bloqueo. */
  maxAttempts: number;
  /** Duracion del primer bloqueo, en milisegundos. */
  baseLockMs: number;
  /** Tope del backoff. Acota la espera para que siempre exista via de recuperacion. */
  maxLockMs: number;
}

export const DEFAULT_LOCKOUT_POLICY: LockoutPolicy = {
  maxAttempts: 5,
  baseLockMs: 60_000,
  maxLockMs: 30 * 60_000,
};

/**
 * Duracion del bloqueo tras `failedAttempts` fallos. Duplica en cada bloqueo sucesivo hasta
 * el tope; devuelve 0 si todavia no se alcanzo el umbral.
 */
export function lockDurationMs(failedAttempts: number, policy: LockoutPolicy): number {
  if (failedAttempts < policy.maxAttempts) return 0;
  const bloqueosPrevios = failedAttempts - policy.maxAttempts;
  const duracion = policy.baseLockMs * 2 ** bloqueosPrevios;
  return Math.min(duracion, policy.maxLockMs);
}
