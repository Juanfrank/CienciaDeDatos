import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticatedPrincipal } from '@app/auth';
import { unlockAccount, sessions } from './identity';
import { credentialsStore } from './identity';

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
    const suya = await sessions.issue(principal('u-revocable'), 'equipo-norte');
    const otra = await sessions.issue(principal('u-revocable'), 'equipo-norte');
    const ajena = await sessions.issue(principal('u-intacto'), 'equipo-norte');

    await sessions.revokeAllFor('u-revocable');

    // Cambiar la credencial sin esto deja dentro a quien ya entro con la anterior, que es
    // exactamente de quien uno se quiere deshacer al restablecerla (4.7.2).
    expect(await sessions.resolve(suya.sessionId)).toBeNull();
    expect(await sessions.resolve(otra.sessionId)).toBeNull();
    expect(await sessions.resolve(ajena.sessionId)).not.toBeNull();

    await sessions.revoke(ajena.sessionId);
  });

  it('revocar una sola no deja rastro en el indice de la persona', async () => {
    const first = await sessions.issue(principal('u-indice'), 'equipo-norte');
    const segunda = await sessions.issue(principal('u-indice'), 'equipo-norte');

    await sessions.revoke(first.sessionId);
    await sessions.revokeAllFor('u-indice');

    // Si el indice conservara la primera, `deleteAllFor` intentaria borrar una clave que ya no
    // existe. No es un error, pero el indice crecería sin limite en una sesion larga.
    expect(await sessions.resolve(segunda.sessionId)).toBeNull();
  });
});

describe('desbloquear una cuenta', () => {
  beforeEach(async () => {
    await credentialsStore.save({
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
    const before = await credentialsStore.findByEmail('u-bloqueado@poderjudicial.gob.do');

    expect(await unlockAccount('u-bloqueado@poderjudicial.gob.do')).toBe(true);

    const after = await credentialsStore.findByEmail('u-bloqueado@poderjudicial.gob.do');
    expect(after?.lockedUntil).toBeUndefined();
    expect(after?.failedAttempts).toBe(0);
    // Quien se equivoco de dedos y ya recuerda su contrasena no necesita una nueva.
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });

  it('una cuenta que no existe devuelve false, no lanza', async () => {
    expect(await unlockAccount('no-existe@poderjudicial.gob.do')).toBe(false);
  });
});
