import { Algorithm, hash } from '@node-rs/argon2';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  InstitutionalMailNotAvailable,
  PasswordResetError,
  PasswordResetService,
  type IResetStore,
  type ResetRecord,
} from './passwordReset';
import { InMemoryAuditLog, InMemoryLocalIdentityStore } from './stores';

/** Restablecimiento de contraseña — seccion 4.7.2. */

const PIMIENTA = 'pimienta-de-prueba';
const PREVIOUS_KEY = 'Anterior-2026!';
const NEW_KEY = 'Nueva-Clave-2026!';

class ResetsStore implements IResetStore {
  readonly registros = new Map<string, ResetRecord>();

  async save(record: ResetRecord): Promise<void> {
    this.registros.set(record.resetId, { ...record });
  }
  async get(resetId: string): Promise<ResetRecord | null> {
    return this.registros.get(resetId) ?? null;
  }
  async listPendingFor(email: string): Promise<ResetRecord[]> {
    return [...this.registros.values()].filter((r) => r.email === email);
  }
}

let almacen: ResetsStore;
let identidades: InMemoryLocalIdentityStore;
let audit: InMemoryAuditLog;
let revocadas: string[];
let ahora: number;
let servicio: PasswordResetService;

beforeEach(async () => {
  almacen = new ResetsStore();
  identidades = new InMemoryLocalIdentityStore();
  audit = new InMemoryAuditLog();
  revocadas = [];
  ahora = Date.parse('2026-09-11T10:00:00.000Z');

  await identidades.save({
    userId: 'u-externo',
    email: 'externo@ejemplo.do',
    passwordHash: await hash(`${PREVIOUS_KEY}${PIMIENTA}`, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }),
    passwordHistory: [],
    failedAttempts: 5,
    // Bloqueada: el restablecimiento es precisamente la via de salida que exige 4.7.2.
    lockedUntil: ahora + 60_000,
    emailVerified: true,
  });

  servicio = new PasswordResetService({
    store: almacen,
    identities: identidades,
    auditLog: audit,
    pepper: PIMIENTA,
    now: () => ahora,
    revokeSessions: async (userId) => {
      revocadas.push(userId);
    },
  });
});

describe('emision del token', () => {
  it('el token NO se guarda en claro', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    const guardado = await almacen.get(emitido.resetId);
    expect(guardado?.tokenHash).not.toContain(emitido.token);
    expect(guardado?.tokenHash.startsWith('$argon2id$')).toBe(true);
    // Y en ningun sitio del registro aparece el secreto.
    expect(JSON.stringify(guardado)).not.toContain(emitido.token);
  });

  it('una cuenta inexistente devuelve null, para que quien llama no pueda distinguirla', async () => {
    expect(await servicio.issue('no-existe@ejemplo.do', 'u-admin')).toBeNull();
  });

  it('emitir uno nuevo invalida el anterior', async () => {
    const primero = await servicio.issue('externo@ejemplo.do', 'u-admin');
    const second = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!primero || !second) throw new Error('deberia emitir');

    await expect(
      servicio.redeem({ resetId: primero.resetId, token: primero.token, newPassword: NEW_KEY }),
    ).rejects.toMatchObject({ reason: 'token-ya-usado' });

    // El segundo si sirve: invalidar el anterior no deja la cuenta sin via de recuperacion.
    await servicio.redeem({
      resetId: second.resetId,
      token: second.token,
      newPassword: NEW_KEY,
    });
  });

  it('queda registrado quien lo tramito', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');
    expect((await almacen.get(emitido.resetId))?.requestedBy).toBe('u-admin');
  });
});

describe('canje del token', () => {
  it('un solo uso: el segundo intento se rechaza', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await servicio.redeem({
      resetId: emitido.resetId,
      token: emitido.token,
      newPassword: NEW_KEY,
    });

    await expect(
      servicio.redeem({
        resetId: emitido.resetId,
        token: emitido.token,
        newPassword: 'Otra-Clave-2026!',
      }),
    ).rejects.toMatchObject({ reason: 'token-ya-usado' });
  });

  it('caduca pronto', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    ahora += 16 * 60_000;

    await expect(
      servicio.redeem({ resetId: emitido.resetId, token: emitido.token, newPassword: NEW_KEY }),
    ).rejects.toMatchObject({ reason: 'token-caducado' });
  });

  it('un token equivocado no sirve, aunque el resetId sea correcto', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await expect(
      servicio.redeem({
        resetId: emitido.resetId,
        token: 'inventado',
        newPassword: NEW_KEY,
      }),
    ).rejects.toMatchObject({ reason: 'token-invalido' });
  });

  it('la contraseña nueva pasa por la politica', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await expect(
      servicio.redeem({ resetId: emitido.resetId, token: emitido.token, newPassword: 'corta' }),
    ).rejects.toMatchObject({ reason: 'politica-incumplida' });
  });

  it('no se puede volver a poner la contraseña anterior', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await expect(
      servicio.redeem({
        resetId: emitido.resetId,
        token: emitido.token,
        newPassword: PREVIOUS_KEY,
      }),
    ).rejects.toMatchObject({ reason: 'reutiliza-contrasena' });
  });

  it('desbloquea la cuenta: un bloqueo sin salida es una cuenta perdida (4.7.2)', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await servicio.redeem({
      resetId: emitido.resetId,
      token: emitido.token,
      newPassword: NEW_KEY,
    });

    const cuenta = await identidades.findByEmail('externo@ejemplo.do');
    expect(cuenta?.lockedUntil).toBeUndefined();
    expect(cuenta?.failedAttempts).toBe(0);
  });

  it('revoca las sesiones abiertas', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await servicio.redeem({
      resetId: emitido.resetId,
      token: emitido.token,
      newPassword: NEW_KEY,
    });

    // Si alguien entro con la contraseña robada, cambiarla sin revocar no lo echa de dentro.
    expect(revocadas).toEqual(['u-externo']);
  });

  it('la contraseña nueva se guarda hasheada y la anterior pasa al historial', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');
    const before = await identidades.findByEmail('externo@ejemplo.do');

    await servicio.redeem({
      resetId: emitido.resetId,
      token: emitido.token,
      newPassword: NEW_KEY,
    });

    const after = await identidades.findByEmail('externo@ejemplo.do');
    expect(after?.passwordHash).not.toBe(before?.passwordHash);
    expect(JSON.stringify(after)).not.toContain(NEW_KEY);
    expect(after?.passwordHistory).toContain(before?.passwordHash);
  });
});

describe('auditoria (seccion 7)', () => {
  it('el exito y el fallo van al MISMO log consolidado que los inicios de sesion', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await servicio
      .redeem({ resetId: emitido.resetId, token: 'mal', newPassword: NEW_KEY })
      .catch(() => undefined);
    await servicio.redeem({
      resetId: emitido.resetId,
      token: emitido.token,
      newPassword: NEW_KEY,
      sourceIp: '10.0.0.7',
    });

    expect(audit.events.map((e) => e.outcome)).toEqual(['fallo', 'exito']);
    expect(audit.events[1]).toMatchObject({
      reason: 'restablecimiento',
      sourceIp: '10.0.0.7',
      userId: 'u-externo',
      authProvider: 'local',
    });
  });
});

describe('el canal de correo se declara y no se finge', () => {
  it('dice que no entrego, en vez de devolver exito', async () => {
    const canal = new InstitutionalMailNotAvailable();
    expect(await canal.deliver()).toBe(false);
    // Y su nombre lo dice, para que quien opera no crea que salio un correo.
    expect(canal.name).toContain('no configurado');
  });
});

describe('PasswordResetError lleva el motivo, no solo un mensaje', () => {
  it('para que quien llama pueda decidir el codigo HTTP sin leer el texto', async () => {
    const fallo = await servicio
      .redeem({ resetId: 'no-existe', token: 'x', newPassword: NEW_KEY })
      .catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(PasswordResetError);
    expect((fallo as PasswordResetError).reason).toBe('token-invalido');
  });
});
