import { beforeEach, describe, expect, it } from 'vitest';
import { TotpSecretUnreadable, type AuthenticatedPrincipal } from '@app/auth';
import { encryptStoredTotpSecrets, unlockAccount, sessions } from './identity';
import { credentialsStore } from './identity';
import { borrar, cacheL2, leer, write } from './almacenCompartido';

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

describe('el secreto TOTP en el almacen', () => {
  const EMAIL = 'u-cifrado@poderjudicial.gob.do';
  const SECRET = 'JBSWY3DPEHPK3PXPJBSW';
  const CLAVE = `auth:credencial:${EMAIL}`;

  const cuenta = (totpSecret?: string) => ({
    userId: 'u-cifrado',
    email: EMAIL,
    passwordHash: '$argon2id$no-importa',
    passwordHistory: [],
    failedAttempts: 0,
    emailVerified: true,
    ...(totpSecret ? { totpSecret } : {}),
  });

  beforeEach(async () => {
    await borrar(CLAVE);
  });

  it('se guarda cifrado, y lo que toca el disco no lo contiene', async () => {
    await credentialsStore.save(cuenta(SECRET));

    const guardado = await leer<Record<string, unknown>>(CLAVE);
    expect(guardado?.['totpSecretCipher']).toEqual(expect.any(String));
    expect(guardado).not.toHaveProperty('totpSecret');
    expect(JSON.stringify(guardado)).not.toContain(SECRET);
  });

  it('vuelve en claro a quien lo pide por el almacen, que es quien verifica el codigo', async () => {
    await credentialsStore.save(cuenta(SECRET));

    expect((await credentialsStore.findByEmail(EMAIL))?.totpSecret).toBe(SECRET);
  });

  it('un registro anterior al cifrado se migra la primera vez que se lee', async () => {
    await write(CLAVE, cuenta(SECRET));

    expect((await credentialsStore.findByEmail(EMAIL))?.totpSecret).toBe(SECRET);

    const guardado = await leer<Record<string, unknown>>(CLAVE);
    expect(guardado).not.toHaveProperty('totpSecret');
    expect(guardado?.['totpSecretCipher']).toEqual(expect.any(String));
  });

  it('un sobre copiado a otra cuenta LANZA, en vez de dejarla sin segundo factor', async () => {
    const AJENA = 'u-ajena@poderjudicial.gob.do';
    await credentialsStore.save(cuenta(SECRET));
    const suyo = await leer<Record<string, unknown>>(CLAVE);

    // Devolver el registro con el secreto ausente seria peor que fallar: el proveedor exige el
    // codigo solo cuando el secreto esta, asi que la cuenta ajena pasaria a entrar con la
    // contrasena sola.
    await write(`auth:credencial:${AJENA}`, { ...suyo, userId: 'u-ajena', email: AJENA });

    await expect(credentialsStore.findByEmail(AJENA)).rejects.toThrow(TotpSecretUnreadable);
    await borrar(`auth:credencial:${AJENA}`);
  });

  it('una cuenta sin segundo factor se guarda sin sobre y se lee sin secreto', async () => {
    await credentialsStore.save(cuenta());

    expect(await leer<Record<string, unknown>>(CLAVE)).not.toHaveProperty('totpSecretCipher');
    expect((await credentialsStore.findByEmail(EMAIL))?.totpSecret).toBeUndefined();
  });
});

describe('cifrar los secretos que quedaron en claro', () => {
  const cuenta = (userId: string, totpSecret?: string) => ({
    userId,
    email: `${userId}@poderjudicial.gob.do`,
    passwordHash: '$argon2id$no-importa',
    passwordHistory: [],
    failedAttempts: 0,
    emailVerified: true,
    ...(totpSecret ? { totpSecret } : {}),
  });

  const claveDe = (userId: string) => `auth:credencial:${userId}@poderjudicial.gob.do`;

  beforeEach(async () => {
    for (const clave of await cacheL2.keysByPrefix('auth:credencial:')) await borrar(clave);
  });

  it('recorre las cuentas dormidas, que son las que la lectura nunca alcanza', async () => {
    await write(claveDe('u-dormida'), cuenta('u-dormida', 'JBSWY3DPEHPK3PXPJBSW'));
    await write(claveDe('u-dormida-dos'), cuenta('u-dormida-dos', 'KRSXG5BAMZQWY3DPFZZA'));
    await credentialsStore.save(cuenta('u-al-dia', 'MFRGGZDFMZTWQ2LKNNWA'));
    await write(claveDe('u-sin-factor'), cuenta('u-sin-factor'));

    expect(await encryptStoredTotpSecrets()).toEqual({ reviewed: 4, migrated: 2 });

    for (const userId of ['u-dormida', 'u-dormida-dos', 'u-al-dia']) {
      const guardado = await leer<Record<string, unknown>>(claveDe(userId));
      expect(guardado).not.toHaveProperty('totpSecret');
      expect(guardado?.['totpSecretCipher']).toEqual(expect.any(String));
    }
    // Una cuenta sin segundo factor no gana uno por pasar el comando.
    expect(await leer<Record<string, unknown>>(claveDe('u-sin-factor'))).not.toHaveProperty(
      'totpSecretCipher',
    );
  });

  it('es idempotente: la segunda pasada no encuentra nada que cifrar', async () => {
    await write(claveDe('u-dormida'), cuenta('u-dormida', 'JBSWY3DPEHPK3PXPJBSW'));
    const sobre = async () =>
      (await leer<Record<string, unknown>>(claveDe('u-dormida')))?.['totpSecretCipher'];

    await encryptStoredTotpSecrets();
    const primero = await sobre();

    expect(await encryptStoredTotpSecrets()).toEqual({ reviewed: 1, migrated: 0 });
    // Y no se vuelve a cifrar lo ya cifrado: el sobre es el mismo.
    expect(await sobre()).toBe(primero);
  });
});
