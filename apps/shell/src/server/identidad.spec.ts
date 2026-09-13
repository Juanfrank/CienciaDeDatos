import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticatedPrincipal } from '@app/auth';
import { desbloquearCuenta, sesiones } from './identidad';
import { almacenDeCredenciales } from './identidad';

/** Cableado de identidad en el shell — seccion 4.7. */

const principal = (userId: string): AuthenticatedPrincipal => ({
  userId,
  displayName: userId,
  authProvider: 'local',
  userPrincipalName: `${userId}@poderjudicial.gob.do`,
  roles: [],
  securityContext: {},
});

describe('revocar todas las sesiones de una persona', () => {
  it('cierra las suyas y no toca las de nadie mas', async () => {
    const suya = await sesiones.issue(principal('u-revocable'), 'equipo-norte');
    const otra = await sesiones.issue(principal('u-revocable'), 'equipo-norte');
    const ajena = await sesiones.issue(principal('u-intacto'), 'equipo-norte');

    await sesiones.revokeAllFor('u-revocable');

    // Cambiar la credencial sin esto deja dentro a quien ya entro con la anterior, que es
    // exactamente de quien uno se quiere deshacer al restablecerla (4.7.2).
    expect(await sesiones.resolve(suya.sessionId)).toBeNull();
    expect(await sesiones.resolve(otra.sessionId)).toBeNull();
    expect(await sesiones.resolve(ajena.sessionId)).not.toBeNull();

    await sesiones.revoke(ajena.sessionId);
  });

  it('revocar una sola no deja rastro en el indice de la persona', async () => {
    const primera = await sesiones.issue(principal('u-indice'), 'equipo-norte');
    const segunda = await sesiones.issue(principal('u-indice'), 'equipo-norte');

    await sesiones.revoke(primera.sessionId);
    await sesiones.revokeAllFor('u-indice');

    // Si el indice conservara la primera, `deleteAllFor` intentaria borrar una clave que ya no
    // existe. No es un error, pero el indice crecería sin limite en una sesion larga.
    expect(await sesiones.resolve(segunda.sessionId)).toBeNull();
  });
});

describe('desbloquear una cuenta', () => {
  beforeEach(async () => {
    await almacenDeCredenciales.save({
      userId: 'u-bloqueado',
      email: 'u-bloqueado@poderjudicial.gob.do',
      passwordHash: '$argon2id$no-importa',
      passwordHistory: [],
      failedAttempts: 5,
      lockedUntil: Date.now() + 60_000,
      emailVerified: true,
    });
  });

  it('pone el contador a cero y quita el bloqueo, SIN tocar la contrasena', async () => {
    const antes = await almacenDeCredenciales.findByEmail('u-bloqueado@poderjudicial.gob.do');

    expect(await desbloquearCuenta('u-bloqueado@poderjudicial.gob.do')).toBe(true);

    const despues = await almacenDeCredenciales.findByEmail('u-bloqueado@poderjudicial.gob.do');
    expect(despues?.lockedUntil).toBeUndefined();
    expect(despues?.failedAttempts).toBe(0);
    // Quien se equivoco de dedos y ya recuerda su contrasena no necesita una nueva.
    expect(despues?.passwordHash).toBe(antes?.passwordHash);
  });

  it('una cuenta que no existe devuelve false, no lanza', async () => {
    expect(await desbloquearCuenta('no-existe@poderjudicial.gob.do')).toBe(false);
  });
});
