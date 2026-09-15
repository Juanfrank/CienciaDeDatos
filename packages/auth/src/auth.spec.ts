import { Secret, TOTP } from 'otpauth';
import { beforeEach, describe, expect, it } from 'vitest';
import { AzureAdIdentityProvider, type ITokenValidator } from './AzureAdIdentityProvider';
import {
  AuthenticationError,
  type DirectoryEntry,
  type IPrincipalDirectory,
} from './IIdentityProvider';
import { LocalIdentityProvider, TOLERANCIA_TOTP_POR_DEFECTO } from './LocalIdentityProvider';
import { SessionService } from './session';
import {
  InMemoryAuditLog,
  InMemoryLocalIdentityStore,
  InMemorySessionStore,
  type LocalCredentialRecord,
} from './stores';

const PEPPER = 'pepper-de-key-vault-solo-para-pruebas';
const GOOD_KEY = 'Tribunal#2026$Norte';

/**
 * Directorio institucional unico: resuelve roles y ambito por el identificador normalizado,
 * sin saber por que puerta entro la persona. Es la pieza que impide el acceso divergente.
 */
class TestDirectory implements IPrincipalDirectory {
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

const directoryEntry: DirectoryEntry = {
  userId: 'u-ana',
  displayName: 'Ana Rodriguez',
  roles: ['colaborador'],
  securityContext: { 'DimTribunal.Distrito': ['Distrito Norte'] },
};

describe('LocalIdentityProvider (4.7.2)', () => {
  let store: InMemoryLocalIdentityStore;
  let directory: TestDirectory;
  let auditLog: InMemoryAuditLog;
  let ahora: number;
  let provider: LocalIdentityProvider;

  const createAccount = async (overrides: Partial<LocalCredentialRecord> = {}) => {
    const record: LocalCredentialRecord = {
      userId: 'u-ana',
      email: 'ana@externo.org',
      passwordHash: await provider.hashPassword(GOOD_KEY),
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
    directory = new TestDirectory();
    directory.add('ana@externo.org', directoryEntry);
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
      const record = await createAccount();
      expect(record.passwordHash).toMatch(/^\$argon2id\$/);
      expect(record.passwordHash).not.toContain(GOOD_KEY);
      expect(JSON.stringify(record)).not.toContain(GOOD_KEY);
    });

    it('el mismo texto produce hashes distintos: hay sal unica por usuario', async () => {
      const a = await provider.hashPassword(GOOD_KEY);
      const b = await provider.hashPassword(GOOD_KEY);
      expect(a).not.toBe(b);
    });

    it('el pepper es necesario para verificar: un volcado de la base no basta', async () => {
      const hash = await provider.hashPassword(GOOD_KEY);
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
        sinPepper.authenticate({ email: 'ana@externo.org', password: GOOD_KEY }),
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
      expect((await provider.validateNewPassword(GOOD_KEY)).ok).toBe(true);
    });

    it('impide reutilizar una de las ultimas N contraseñas', async () => {
      const record = await createAccount();
      const r = await provider.validateNewPassword(GOOD_KEY, record);
      expect(r.ok).toBe(false);
      expect(r.violations.map((v) => v.rule)).toContain('historyReuse');
    });

    it('al cambiar la contraseña desplaza el historial y desbloquea la cuenta', async () => {
      const record = await createAccount({ failedAttempts: 4, lockedUntil: ahora + 1000 });
      const updated = await provider.setPassword(record, 'Audiencia#2027$Este');
      expect(updated.passwordHistory).toContain(record.passwordHash);
      expect(updated.failedAttempts).toBe(0);
      expect(updated.lockedUntil).toBeUndefined();
    });
  });

  describe('bloqueo con backoff progresivo', () => {
    it('bloquea la cuenta tras los intentos configurados', async () => {
      await createAccount();
      for (let i = 0; i < 5; i++) {
        await expect(
          provider.authenticate({ email: 'ana@externo.org', password: 'incorrecta' }),
        ).rejects.toThrow(AuthenticationError);
      }
      await expect(
        provider.authenticate({ email: 'ana@externo.org', password: GOOD_KEY }),
      ).rejects.toMatchObject({ reason: 'cuenta-bloqueada' });
    });

    it('el bloqueo expira: siempre hay via de recuperacion, nunca es indefinido', async () => {
      await createAccount();
      for (let i = 0; i < 5; i++) {
        await provider
          .authenticate({ email: 'ana@externo.org', password: 'incorrecta' })
          .catch(() => undefined);
      }
      ahora += 31 * 60 * 1000;
      const principal = await provider.authenticate({
        email: 'ana@externo.org',
        password: GOOD_KEY,
      });
      expect(principal.userId).toBe('u-ana');
    });

    it('un login correcto reinicia el contador de fallos', async () => {
      await createAccount();
      await provider
        .authenticate({ email: 'ana@externo.org', password: 'incorrecta' })
        .catch(() => undefined);
      await provider.authenticate({ email: 'ana@externo.org', password: GOOD_KEY });
      const record = await store.findByEmail('ana@externo.org');
      expect(record?.failedAttempts).toBe(0);
    });
  });

  describe('TOTP obligatorio (compensa la ausencia de acceso condicional)', () => {
    const secreto = new Secret({ size: 20 }).base32;
    const validCode = (t: number) =>
      new TOTP({ secret: secreto, algorithm: 'SHA1', digits: 6, period: 30 }).generate({
        timestamp: t,
      });

    it('exige el segundo factor si la cuenta lo tiene configurado', async () => {
      await createAccount({ totpSecret: secreto });
      await expect(
        provider.authenticate({ email: 'ana@externo.org', password: GOOD_KEY }),
      ).rejects.toMatchObject({ reason: 'mfa-requerido' });
    });

    it('rechaza un codigo invalido y lo cuenta como intento fallido', async () => {
      await createAccount({ totpSecret: secreto });
      await expect(
        provider.authenticate({
          email: 'ana@externo.org',
          password: GOOD_KEY,
          totpCode: '000000',
        }),
      ).rejects.toMatchObject({ reason: 'mfa-invalido' });
      expect((await store.findByEmail('ana@externo.org'))?.failedAttempts).toBe(1);
    });

    it('acepta un codigo valido', async () => {
      await createAccount({ totpSecret: secreto });
      const principal = await provider.authenticate({
        email: 'ana@externo.org',
        password: GOOD_KEY,
        totpCode: validCode(ahora),
      });
      expect(principal.authProvider).toBe('local');
    });

    /*
     * La ventana se ensancha a proposito, y solo fuera de produccion.
     *
     * En desarrollo el codigo se lee de la pantalla y se teclea a mano, y treinta segundos
     * convierten entrar en una carrera. Alargarlo alarga exactamente igual la ventana en la que
     * un codigo robado sirve, asi que es un ajuste que hay que pedir a proposito: por defecto
     * sigue siendo un paso, y `apps/shell/src/server/identity.ts` se niega a ensancharlo con
     * `NODE_ENV=production`.
     */
    const HACE_CINCO_MINUTOS = 5 * 60 * 1000;

    it('por defecto, un codigo de hace cinco minutos ya no vale', async () => {
      await createAccount({ totpSecret: secreto });
      await expect(
        provider.authenticate({
          email: 'ana@externo.org',
          password: GOOD_KEY,
          totpCode: validCode(ahora - HACE_CINCO_MINUTOS),
        }),
      ).rejects.toMatchObject({ reason: 'mfa-invalido' });
    });

    it('con la tolerancia ensanchada a diez minutos, si', async () => {
      await createAccount({ totpSecret: secreto });
      const tolerante = new LocalIdentityProvider({
        store,
        directory,
        auditLog,
        pepper: PEPPER,
        totpToleranceSteps: 20,
        now: () => ahora,
      });

      const principal = await tolerante.authenticate({
        email: 'ana@externo.org',
        password: GOOD_KEY,
        totpCode: validCode(ahora - HACE_CINCO_MINUTOS),
      });
      expect(principal.authProvider).toBe('local');
    });

    it('y aun ensanchada, uno de hace media hora sigue sin valer', async () => {
      // Ensanchar no es apagar: la ventana crece hasta donde se dijo y ni un paso mas.
      await createAccount({ totpSecret: secreto });
      const tolerante = new LocalIdentityProvider({
        store,
        directory,
        auditLog,
        pepper: PEPPER,
        totpToleranceSteps: 20,
        now: () => ahora,
      });

      await expect(
        tolerante.authenticate({
          email: 'ana@externo.org',
          password: GOOD_KEY,
          totpCode: validCode(ahora - 30 * 60 * 1000),
        }),
      ).rejects.toMatchObject({ reason: 'mfa-invalido' });
    });

    it('el valor por defecto es UN paso, y esta dicho en un solo sitio', () => {
      expect(TOLERANCIA_TOTP_POR_DEFECTO).toBe(1);
    });
  });

  describe('auditoria de acceso (seccion 7)', () => {
    it('registra exito y fallo con marca de tiempo, IP y resultado', async () => {
      await createAccount();
      await provider
        .authenticate({ email: 'ana@externo.org', password: 'mala', sourceIp: '10.0.0.5' })
        .catch(() => undefined);
      await provider.authenticate({
        email: 'ana@externo.org',
        password: GOOD_KEY,
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

    /*
     * Y tampoco lo revela el RELOJ, que es por donde se escapaba.
     *
     * El mensaje era el mismo desde el principio; el tiempo no. Argon2id con m=19456 tarda
     * decenas de milisegundos a proposito, y la rama de «esta cuenta no existe» salia sin
     * verificar nada, en microsegundos. Con eso, quien recorra una lista de correos midiendo lo
     * que tarda la respuesta separa las cuentas de la institucion de las que no lo son, sin
     * acertar ni una contraseña y sin dejar mas rastro que intentos fallidos normales.
     *
     * Se comparan las dos ramas, no un umbral en milisegundos: una cifra absoluta depende de la
     * maquina y acaba relajandose hasta no comprobar nada. La proporcion no: antes del arreglo
     * era del orden de 0,01 —dos ordenes de magnitud— y ahora ronda 1.
     */
    it('ni por el tiempo que tarda en contestar', async () => {
      await createAccount();
      // El primer Argon2 del proceso paga la inicializacion, y el hash de relleno se calcula una
      // sola vez: sin calentar, la primera medicion mide otra cosa.
      await expect(
        provider.authenticate({ email: 'ana@externo.org', password: 'mal' }),
      ).rejects.toThrow();
      await expect(
        provider.authenticate({ email: 'nadie@externo.org', password: 'mal' }),
      ).rejects.toThrow();

      const mide = async (email: string) => {
        const desde = performance.now();
        await expect(provider.authenticate({ email, password: 'mal' })).rejects.toThrow();
        return performance.now() - desde;
      };

      const existe = await mide('ana@externo.org');
      const noExiste = await mide('nadie@externo.org');

      expect(noExiste).toBeGreaterThan(existe * 0.5);
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
    const directory = new TestDirectory();
    directory.add('ana@institucion.gob', directoryEntry);
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
    const directory = new TestDirectory();
    const auditLog = new InMemoryAuditLog();
    const provider = new AzureAdIdentityProvider({ tokenValidator: validador, directory, auditLog });
    await expect(provider.authenticate({ token: 'token-valido' })).rejects.toMatchObject({
      reason: 'sin-identidad-institucional',
    });
  });
});

describe('normalizacion de identidad: los dos caminos convergen (4.7.3)', () => {
  it('ambos proveedores producen un principal con la MISMA forma', async () => {
    const directory = new TestDirectory();
    directory.add('ana@institucion.gob', directoryEntry);
    directory.add('ana@externo.org', directoryEntry);
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
      passwordHash: await local.hashPassword(GOOD_KEY),
      passwordHistory: [],
      failedAttempts: 0,
      emailVerified: true,
    });
    const accountLocal = new LocalIdentityProvider({ store, directory, auditLog, pepper: PEPPER });

    const porAzure = await new AzureAdIdentityProvider({
      tokenValidator: {
        async validate() {
          return { oid: 'oid-ana', userPrincipalName: 'ana@institucion.gob', name: 'Ana Rodriguez' };
        },
      },
      directory,
      auditLog,
    }).authenticate({ token: 't' });

    const porLocal = await accountLocal.authenticate({
      email: 'ana@externo.org',
      password: GOOD_KEY,
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
    const directory = new TestDirectory();
    directory.add('ana@institucion.gob', directoryEntry);
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

describe('fuerza bruta en paralelo (4.7.2)', () => {
  /**
   * El bloqueo por intentos fallidos solo sirve si CUENTA los intentos.
   *
   * Quien ataca no prueba una contrasena y espera la respuesta: lanza todas a la vez. Si cada
   * intento lee el contador antes de que ninguno lo haya escrito, los diez leen cero y los diez
   * escriben uno: el contador se queda en 1 y la cuenta no se bloquea nunca. El bloqueo estaria
   * escrito, probado en serie, y no impediria nada.
   */
  it('diez intentos fallidos a la vez bloquean la cuenta', async () => {
    const store = new InMemoryLocalIdentityStore();
    const directory = new TestDirectory();
    directory.add('ana@externo.org', directoryEntry);
    const auditLog = new InMemoryAuditLog();
    const ahora = Date.UTC(2026, 8, 11, 8, 0, 0);
    const provider = new LocalIdentityProvider({
      store,
      directory,
      auditLog,
      pepper: PEPPER,
      now: () => ahora,
    });

    await store.save({
      userId: 'u-ana',
      email: 'ana@externo.org',
      passwordHash: await provider.hashPassword(GOOD_KEY),
      passwordHistory: [],
      failedAttempts: 0,
      emailVerified: true,
    });

    const intentos = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        provider.authenticate({ email: 'ana@externo.org', password: 'no-es-la-buena' }),
      ),
    );
    expect(intentos.every((r) => r.status === 'rejected')).toBe(true);

    const registro = await store.findByEmail('ana@externo.org');
    // Exactamente CINCO, que es el maximo de la politica: los cinco primeros suman, el quinto
    // bloquea la cuenta y del sexto en adelante se rechazan sin llegar a verificar nada. Que la
    // cifra sea justo el maximo —y no diez, ni uno— es lo que dice que los intentos se contaron
    // de uno en uno y que el bloqueo surtio efecto dentro de la misma rafaga.
    expect(registro?.failedAttempts).toBe(5);
    expect(registro?.lockedUntil).toBeGreaterThan(ahora);

    // Y la contrasena BUENA tampoco entra mientras dure el bloqueo: es lo que el bloqueo es.
    await expect(
      provider.authenticate({ email: 'ana@externo.org', password: GOOD_KEY }),
    ).rejects.toMatchObject({ reason: 'cuenta-bloqueada' });
  });

  it('cuentas distintas no se esperan entre si', async () => {
    /*
     * Serializar por cuenta es lo correcto; serializarlo todo convertiria el inicio de sesion de
     * la institucion entera en una fila detras de quien se equivoque de contrasena.
     *
     * Se comprueba por CONCURRENCIA OBSERVADA y no por reloj. La version anterior cronometraba
     * tres verificaciones Argon2 en paralelo contra tres en fila y exigia que las primeras
     * tardaran menos; con la maquina cargada —el resto de proyectos corriendo a la vez— no hay
     * nucleos que repartir, la medida se invierte y la prueba falla sin que nada este roto. Una
     * prueba que depende de cuanta carga tiene la maquina no dice nada sobre el codigo.
     *
     * Aqui el almacen se queda parado a proposito: si el turno fuera global, solo UNA de las tres
     * llegaria a pedir su registro y las otras dos esperarian a que esta terminara. Que lleguen
     * las tres es exactamente la propiedad que se quiere.
     */
    const store = new InMemoryLocalIdentityStore();
    const directory = new TestDirectory();
    const auditLog = new InMemoryAuditLog();
    const provider = new LocalIdentityProvider({
      store,
      directory,
      auditLog,
      pepper: PEPPER,
      now: () => Date.UTC(2026, 8, 11, 8, 0, 0),
    });

    const correos = ['a@externo.org', 'b@externo.org', 'c@externo.org'];
    for (const email of correos) {
      directory.add(email, directoryEntry);
      await store.save({
        userId: `u-${email}`,
        email,
        passwordHash: await provider.hashPassword(GOOD_KEY),
        passwordHistory: [],
        failedAttempts: 0,
        emailVerified: true,
      });
    }

    // El almacen se para en la primera lectura de cada cuenta y no sigue hasta que se le diga.
    let dentro = 0;
    let soltar!: () => void;
    const puerta = new Promise<void>((listo) => {
      soltar = listo;
    });
    const original = store.findByEmail.bind(store);
    const llegaron = new Promise<void>((cumplido) => {
      store.findByEmail = async (email: string) => {
        dentro += 1;
        if (dentro === correos.length) cumplido();
        await puerta;
        return original(email);
      };
    });

    const vuelo = Promise.all(
      correos.map((email) => provider.authenticate({ email, password: GOOD_KEY })),
    );

    // Si el turno fuera global esto no se cumpliria nunca y la prueba moriria por tiempo, que es
    // la forma de fallar que corresponde a «se estan esperando».
    await llegaron;
    expect(dentro).toBe(correos.length);

    soltar();
    const principales = await vuelo;
    // Y las tres terminan bien: soltar la puerta no deja a ninguna a medias.
    expect(principales.map((p) => p.authProvider)).toEqual(['local', 'local', 'local']);
  });
});
