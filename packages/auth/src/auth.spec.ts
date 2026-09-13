import { Secret, TOTP } from 'otpauth';
import { beforeEach, describe, expect, it } from 'vitest';
import { AzureAdIdentityProvider, type ITokenValidator } from './AzureAdIdentityProvider';
import {
  AuthenticationError,
  type DirectoryEntry,
  type IPrincipalDirectory,
} from './IIdentityProvider';
import { LocalIdentityProvider } from './LocalIdentityProvider';
import { SessionService } from './session';
import {
  InMemoryAuditLog,
  InMemoryLocalIdentityStore,
  InMemorySessionStore,
  type LocalCredentialRecord,
} from './stores';

const PEPPER = 'pepper-de-key-vault-solo-para-pruebas';
const CLAVE_BUENA = 'Tribunal#2026$Norte';

/**
 * Directorio institucional unico: resuelve roles y ambito por el identificador normalizado,
 * sin saber por que puerta entro la persona. Es la pieza que impide el acceso divergente.
 */
class DirectorioDePrueba implements IPrincipalDirectory {
  private readonly entradas = new Map<string, DirectoryEntry>();
  lookups: string[] = [];

  add(upn: string, entry: DirectoryEntry): void {
    this.entradas.set(upn.toLowerCase(), entry);
  }
  async lookup(upn: string): Promise<DirectoryEntry | null> {
    this.lookups.push(upn);
    return this.entradas.get(upn.toLowerCase()) ?? null;
  }
}

const entradaDirectorio: DirectoryEntry = {
  userId: 'u-ana',
  displayName: 'Ana Rodriguez',
  roles: ['colaborador'],
  securityContext: { 'DimTribunal.Distrito': ['Distrito Norte'] },
};

describe('LocalIdentityProvider (4.7.2)', () => {
  let store: InMemoryLocalIdentityStore;
  let directory: DirectorioDePrueba;
  let auditLog: InMemoryAuditLog;
  let ahora: number;
  let provider: LocalIdentityProvider;

  const crearCuenta = async (overrides: Partial<LocalCredentialRecord> = {}) => {
    const record: LocalCredentialRecord = {
      userId: 'u-ana',
      email: 'ana@externo.org',
      passwordHash: await provider.hashPassword(CLAVE_BUENA),
      passwordHistory: [],
      failedAttempts: 0,
      emailVerified: true,
      ...overrides,
    };
    await store.save(record);
    return record;
  };

  beforeEach(() => {
    store = new InMemoryLocalIdentityStore();
    directory = new DirectorioDePrueba();
    directory.add('ana@externo.org', entradaDirectorio);
    auditLog = new InMemoryAuditLog();
    ahora = Date.UTC(2026, 8, 11, 8, 0, 0);
    provider = new LocalIdentityProvider({
      store,
      directory,
      auditLog,
      pepper: PEPPER,
      now: () => ahora,
    });
  });

  describe('almacenamiento de credenciales', () => {
    it('exige un pepper de aplicacion: no se puede construir sin el', () => {
      expect(
        () => new LocalIdentityProvider({ store, directory, auditLog, pepper: '' }),
      ).toThrow(/requiere un pepper/);
    });

    it('nunca guarda la contrasena en claro ni de forma reversible', async () => {
      const record = await crearCuenta();
      expect(record.passwordHash).toMatch(/^\$argon2id\$/);
      expect(record.passwordHash).not.toContain(CLAVE_BUENA);
      expect(JSON.stringify(record)).not.toContain(CLAVE_BUENA);
    });

    it('el mismo texto produce hashes distintos: hay sal unica por usuario', async () => {
      const a = await provider.hashPassword(CLAVE_BUENA);
      const b = await provider.hashPassword(CLAVE_BUENA);
      expect(a).not.toBe(b);
    });

    it('el pepper es necesario para verificar: un volcado de la base no basta', async () => {
      const hash = await provider.hashPassword(CLAVE_BUENA);
      const sinPepper = new LocalIdentityProvider({
        store,
        directory,
        auditLog,
        pepper: 'otro-pepper-distinto',
        now: () => ahora,
      });
      await store.save({
        userId: 'u-ana',
        email: 'ana@externo.org',
        passwordHash: hash,
        passwordHistory: [],
        failedAttempts: 0,
        emailVerified: true,
      });
      await expect(
        sinPepper.authenticate({ email: 'ana@externo.org', password: CLAVE_BUENA }),
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('politica de contraseña', () => {
    it('rechaza contraseñas que no cumplen la politica', async () => {
      const r = await provider.validateNewPassword('corta');
      expect(r.ok).toBe(false);
      expect(r.violations.map((v) => v.rule)).toContain('minLength');
    });

    it('acepta una contraseña que cumple', async () => {
      expect((await provider.validateNewPassword(CLAVE_BUENA)).ok).toBe(true);
    });

    it('impide reutilizar una de las ultimas N contraseñas', async () => {
      const record = await crearCuenta();
      const r = await provider.validateNewPassword(CLAVE_BUENA, record);
      expect(r.ok).toBe(false);
      expect(r.violations.map((v) => v.rule)).toContain('historyReuse');
    });

    it('al cambiar la contraseña desplaza el historial y desbloquea la cuenta', async () => {
      const record = await crearCuenta({ failedAttempts: 4, lockedUntil: ahora + 1000 });
      const updated = await provider.setPassword(record, 'Audiencia#2027$Este');
      expect(updated.passwordHistory).toContain(record.passwordHash);
      expect(updated.failedAttempts).toBe(0);
      expect(updated.lockedUntil).toBeUndefined();
    });
  });

  describe('bloqueo con backoff progresivo', () => {
    it('bloquea la cuenta tras los intentos configurados', async () => {
      await crearCuenta();
      for (let i = 0; i < 5; i++) {
        await expect(
          provider.authenticate({ email: 'ana@externo.org', password: 'incorrecta' }),
        ).rejects.toThrow(AuthenticationError);
      }
      await expect(
        provider.authenticate({ email: 'ana@externo.org', password: CLAVE_BUENA }),
      ).rejects.toMatchObject({ reason: 'cuenta-bloqueada' });
    });

    it('el bloqueo expira: siempre hay via de recuperacion, nunca es indefinido', async () => {
      await crearCuenta();
      for (let i = 0; i < 5; i++) {
        await provider
          .authenticate({ email: 'ana@externo.org', password: 'incorrecta' })
          .catch(() => undefined);
      }
      ahora += 31 * 60 * 1000;
      const principal = await provider.authenticate({
        email: 'ana@externo.org',
        password: CLAVE_BUENA,
      });
      expect(principal.userId).toBe('u-ana');
    });

    it('un login correcto reinicia el contador de fallos', async () => {
      await crearCuenta();
      await provider
        .authenticate({ email: 'ana@externo.org', password: 'incorrecta' })
        .catch(() => undefined);
      await provider.authenticate({ email: 'ana@externo.org', password: CLAVE_BUENA });
      const record = await store.findByEmail('ana@externo.org');
      expect(record?.failedAttempts).toBe(0);
    });
  });

  describe('TOTP obligatorio (compensa la ausencia de acceso condicional)', () => {
    const secreto = new Secret({ size: 20 }).base32;
    const codigoValido = (t: number) =>
      new TOTP({ secret: secreto, algorithm: 'SHA1', digits: 6, period: 30 }).generate({
        timestamp: t,
      });

    it('exige el segundo factor si la cuenta lo tiene configurado', async () => {
      await crearCuenta({ totpSecret: secreto });
      await expect(
        provider.authenticate({ email: 'ana@externo.org', password: CLAVE_BUENA }),
      ).rejects.toMatchObject({ reason: 'mfa-requerido' });
    });

    it('rechaza un codigo invalido y lo cuenta como intento fallido', async () => {
      await crearCuenta({ totpSecret: secreto });
      await expect(
        provider.authenticate({
          email: 'ana@externo.org',
          password: CLAVE_BUENA,
          totpCode: '000000',
        }),
      ).rejects.toMatchObject({ reason: 'mfa-invalido' });
      expect((await store.findByEmail('ana@externo.org'))?.failedAttempts).toBe(1);
    });

    it('acepta un codigo valido', async () => {
      await crearCuenta({ totpSecret: secreto });
      const principal = await provider.authenticate({
        email: 'ana@externo.org',
        password: CLAVE_BUENA,
        totpCode: codigoValido(ahora),
      });
      expect(principal.authProvider).toBe('local');
    });
  });

  describe('auditoria de acceso (seccion 7)', () => {
    it('registra exito y fallo con marca de tiempo, IP y resultado', async () => {
      await crearCuenta();
      await provider
        .authenticate({ email: 'ana@externo.org', password: 'mala', sourceIp: '10.0.0.5' })
        .catch(() => undefined);
      await provider.authenticate({
        email: 'ana@externo.org',
        password: CLAVE_BUENA,
        sourceIp: '10.0.0.5',
      });

      expect(auditLog.events).toHaveLength(2);
      expect(auditLog.events[0]).toMatchObject({
        authProvider: 'local',
        outcome: 'fallo',
        reason: 'credenciales-invalidas',
        sourceIp: '10.0.0.5',
      });
      expect(auditLog.events[1]).toMatchObject({ outcome: 'exito', userId: 'u-ana' });
    });

    it('no revela si un correo existe: mismo error para cuenta inexistente', async () => {
      await expect(
        provider.authenticate({ email: 'nadie@externo.org', password: 'lo-que-sea' }),
      ).rejects.toMatchObject({ reason: 'credenciales-invalidas' });
      expect(auditLog.events[0]?.reason).toBe('credenciales-invalidas');
    });
  });
});

describe('AzureAdIdentityProvider (4.7.1)', () => {
  const validador: ITokenValidator = {
    async validate(token: string) {
      if (token !== 'token-valido') throw new Error('firma invalida');
      return { oid: 'oid-ana', userPrincipalName: 'ana@institucion.gob', name: 'Ana Rodriguez' };
    },
  };

  const build = () => {
    const directory = new DirectorioDePrueba();
    directory.add('ana@institucion.gob', entradaDirectorio);
    const auditLog = new InMemoryAuditLog();
    return {
      directory,
      auditLog,
      provider: new AzureAdIdentityProvider({ tokenValidator: validador, directory, auditLog }),
    };
  };

  it('valida el token en el backend, no confia solo en el perimetro', async () => {
    const { provider } = build();
    await expect(provider.authenticate({ token: 'falsificado' })).rejects.toMatchObject({
      reason: 'token-invalido',
    });
  });

  it('produce un principal con la identidad normalizada', async () => {
    const { provider } = build();
    const principal = await provider.authenticate({ token: 'token-valido' });
    expect(principal).toEqual({
      userId: 'u-ana',
      displayName: 'Ana Rodriguez',
      authProvider: 'azure-ad',
      userPrincipalName: 'ana@institucion.gob',
      roles: ['colaborador'],
      securityContext: { 'DimTribunal.Distrito': ['Distrito Norte'] },
    });
  });

  it('registra el login en el mismo log consolidado que las cuentas locales', async () => {
    const { provider, auditLog } = build();
    await provider.authenticate({ token: 'token-valido', sourceIp: '10.0.0.9' });
    expect(auditLog.events[0]).toMatchObject({
      authProvider: 'azure-ad',
      outcome: 'exito',
      sourceIp: '10.0.0.9',
    });
  });

  it('rechaza una identidad sin roles ni ambito en el directorio', async () => {
    const directory = new DirectorioDePrueba();
    const auditLog = new InMemoryAuditLog();
    const provider = new AzureAdIdentityProvider({ tokenValidator: validador, directory, auditLog });
    await expect(provider.authenticate({ token: 'token-valido' })).rejects.toMatchObject({
      reason: 'sin-identidad-institucional',
    });
  });
});

describe('normalizacion de identidad: los dos caminos convergen (4.7.3)', () => {
  it('ambos proveedores producen un principal con la MISMA forma', async () => {
    const directory = new DirectorioDePrueba();
    directory.add('ana@institucion.gob', entradaDirectorio);
    directory.add('ana@externo.org', entradaDirectorio);
    const auditLog = new InMemoryAuditLog();

    const local = new LocalIdentityProvider({
      store: new InMemoryLocalIdentityStore(),
      directory,
      auditLog,
      pepper: PEPPER,
    });
    const store = new InMemoryLocalIdentityStore();
    await store.save({
      userId: 'u-ana',
      email: 'ana@externo.org',
      passwordHash: await local.hashPassword(CLAVE_BUENA),
      passwordHistory: [],
      failedAttempts: 0,
      emailVerified: true,
    });
    const localConCuenta = new LocalIdentityProvider({ store, directory, auditLog, pepper: PEPPER });

    const porAzure = await new AzureAdIdentityProvider({
      tokenValidator: {
        async validate() {
          return { oid: 'oid-ana', userPrincipalName: 'ana@institucion.gob', name: 'Ana Rodriguez' };
        },
      },
      directory,
      auditLog,
    }).authenticate({ token: 't' });

    const porLocal = await localConCuenta.authenticate({
      email: 'ana@externo.org',
      password: CLAVE_BUENA,
    });

    // Misma forma exacta: ningun consumidor aguas abajo necesita ramificar.
    expect(Object.keys(porAzure).sort()).toEqual(Object.keys(porLocal).sort());
    // Mismos roles y mismo ambito: el acceso a datos no depende de la puerta de entrada.
    expect(porAzure.roles).toEqual(porLocal.roles);
    expect(porAzure.securityContext).toEqual(porLocal.securityContext);
    expect(porAzure.userId).toBe(porLocal.userId);
    // Lo unico que difiere es el rastro de auditoria.
    expect(porAzure.authProvider).not.toBe(porLocal.authProvider);
  });

  it('ambos proveedores resuelven roles contra el MISMO directorio institucional', async () => {
    const directory = new DirectorioDePrueba();
    directory.add('ana@institucion.gob', entradaDirectorio);
    const auditLog = new InMemoryAuditLog();
    await new AzureAdIdentityProvider({
      tokenValidator: {
        async validate() {
          return { oid: 'o', userPrincipalName: 'ana@institucion.gob' };
        },
      },
      directory,
      auditLog,
    }).authenticate({ token: 't' });
    expect(directory.lookups).toEqual(['ana@institucion.gob']);
  });
});

describe('SessionService (6.7 y 4.10.2)', () => {
  let store: InMemorySessionStore;
  let ahora: number;
  let service: SessionService;
  let contador: number;

  beforeEach(() => {
    store = new InMemorySessionStore();
    ahora = Date.UTC(2026, 8, 11, 8, 0, 0);
    contador = 0;
    service = new SessionService({
      store,
      ttlMs: 60_000,
      now: () => ahora,
      newId: () => `sesion-${++contador}`,
    });
  });

  const principal = {
    userId: 'u-ana',
    displayName: 'Ana',
    authProvider: 'local' as const,
    userPrincipalName: 'ana@externo.org',
    roles: ['colaborador'],
    securityContext: {},
  };

  it('emite el mismo tipo de sesion venga de donde venga el login', async () => {
    const porLocal = await service.issue(principal, 'equipo-norte');
    const porAzure = await service.issue({ ...principal, authProvider: 'azure-ad' }, 'equipo-norte');
    expect(Object.keys(porLocal).sort()).toEqual(Object.keys(porAzure).sort());
  });

  it('el estado vive del lado servidor: el id es opaco', async () => {
    const session = await service.issue(principal, 'equipo-norte');
    expect(session.sessionId).toBe('sesion-1');
    expect(session.sessionId).not.toContain('u-ana');
    expect(await service.resolve('sesion-1')).toMatchObject({ userId: 'u-ana' });
  });

  it('cambiar el equipo activo surte efecto SIN cerrar sesion', async () => {
    const session = await service.issue(principal, 'equipo-norte');
    const cambiada = await service.switchActiveTeam(session.sessionId, 'equipo-este');
    expect(cambiada.sessionId).toBe(session.sessionId);
    expect(cambiada.activeTeamId).toBe('equipo-este');
    expect((await service.resolve(session.sessionId))?.activeTeamId).toBe('equipo-este');
  });

  it('la sesion expira', async () => {
    const session = await service.issue(principal, 'equipo-norte');
    ahora += 61_000;
    expect(await service.resolve(session.sessionId)).toBeNull();
  });

  it('revocar es borrar la fila, no esperar a que expire un token', async () => {
    const session = await service.issue(principal, 'equipo-norte');
    await service.revoke(session.sessionId);
    expect(await service.resolve(session.sessionId)).toBeNull();
  });
});
