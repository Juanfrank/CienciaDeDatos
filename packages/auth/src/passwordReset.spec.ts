import { Algorithm, hash } from '@node-rs/argon2';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CorreoInstitucionalNoDisponible,
  PasswordResetError,
  PasswordResetService,
  type IResetStore,
  type ResetRecord,
} from './passwordReset';
import { InMemoryAuditLog, InMemoryLocalIdentityStore } from './stores';

/**
 * Restablecimiento de contraseña — seccion 4.7.2.
 *
 * Lo que se comprueba: un solo uso, expiracion corta, nada en claro en el almacen, la politica
 * de contraseñas y la no reutilizacion aplicadas tambien aqui, el desbloqueo de la cuenta y la
 * revocacion de las sesiones abiertas.
 */

const PIMIENTA = 'pimienta-de-prueba';
const CLAVE_ANTERIOR = 'Anterior-2026!';
const CLAVE_NUEVA = 'Nueva-Clave-2026!';

class AlmacenDeRestablecimientos implements IResetStore {
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

let almacen: AlmacenDeRestablecimientos;
let identidades: InMemoryLocalIdentityStore;
let auditoria: InMemoryAuditLog;
let revocadas: string[];
let ahora: number;
let servicio: PasswordResetService;

beforeEach(async () => {
  almacen = new AlmacenDeRestablecimientos();
  identidades = new InMemoryLocalIdentityStore();
  auditoria = new InMemoryAuditLog();
  revocadas = [];
  ahora = Date.parse('2026-09-11T10:00:00.000Z');

  await identidades.save({
    userId: 'u-externo',
    email: 'externo@ejemplo.do',
    passwordHash: await hash(`${CLAVE_ANTERIOR}${PIMIENTA}`, {
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
    auditLog: auditoria,
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
    const segundo = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!primero || !segundo) throw new Error('deberia emitir');

    await expect(
      servicio.redeem({ resetId: primero.resetId, token: primero.token, newPassword: CLAVE_NUEVA }),
    ).rejects.toMatchObject({ reason: 'token-ya-usado' });

    // El segundo si sirve: invalidar el anterior no deja la cuenta sin via de recuperacion.
    await servicio.redeem({
      resetId: segundo.resetId,
      token: segundo.token,
      newPassword: CLAVE_NUEVA,
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
      newPassword: CLAVE_NUEVA,
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
      servicio.redeem({ resetId: emitido.resetId, token: emitido.token, newPassword: CLAVE_NUEVA }),
    ).rejects.toMatchObject({ reason: 'token-caducado' });
  });

  it('un token equivocado no sirve, aunque el resetId sea correcto', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await expect(
      servicio.redeem({
        resetId: emitido.resetId,
        token: 'inventado',
        newPassword: CLAVE_NUEVA,
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
        newPassword: CLAVE_ANTERIOR,
      }),
    ).rejects.toMatchObject({ reason: 'reutiliza-contrasena' });
  });

  it('desbloquea la cuenta: un bloqueo sin salida es una cuenta perdida (4.7.2)', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await servicio.redeem({
      resetId: emitido.resetId,
      token: emitido.token,
      newPassword: CLAVE_NUEVA,
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
      newPassword: CLAVE_NUEVA,
    });

    // Si alguien entro con la contraseña robada, cambiarla sin revocar no lo echa de dentro.
    expect(revocadas).toEqual(['u-externo']);
  });

  it('la contraseña nueva se guarda hasheada y la anterior pasa al historial', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');
    const antes = await identidades.findByEmail('externo@ejemplo.do');

    await servicio.redeem({
      resetId: emitido.resetId,
      token: emitido.token,
      newPassword: CLAVE_NUEVA,
    });

    const despues = await identidades.findByEmail('externo@ejemplo.do');
    expect(despues?.passwordHash).not.toBe(antes?.passwordHash);
    expect(JSON.stringify(despues)).not.toContain(CLAVE_NUEVA);
    expect(despues?.passwordHistory).toContain(antes?.passwordHash);
  });
});

describe('auditoria (seccion 7)', () => {
  it('el exito y el fallo van al MISMO log consolidado que los inicios de sesion', async () => {
    const emitido = await servicio.issue('externo@ejemplo.do', 'u-admin');
    if (!emitido) throw new Error('deberia emitir');

    await servicio
      .redeem({ resetId: emitido.resetId, token: 'mal', newPassword: CLAVE_NUEVA })
      .catch(() => undefined);
    await servicio.redeem({
      resetId: emitido.resetId,
      token: emitido.token,
      newPassword: CLAVE_NUEVA,
      sourceIp: '10.0.0.7',
    });

    expect(auditoria.events.map((e) => e.outcome)).toEqual(['fallo', 'exito']);
    expect(auditoria.events[1]).toMatchObject({
      reason: 'restablecimiento',
      sourceIp: '10.0.0.7',
      userId: 'u-externo',
      authProvider: 'local',
    });
  });
});

describe('el canal de correo se declara y no se finge', () => {
  it('dice que no entrego, en vez de devolver exito', async () => {
    const canal = new CorreoInstitucionalNoDisponible();
    expect(await canal.deliver()).toBe(false);
    // Y su nombre lo dice, para que quien opera no crea que salio un correo.
    expect(canal.name).toContain('no configurado');
  });
});

describe('PasswordResetError lleva el motivo, no solo un mensaje', () => {
  it('para que quien llama pueda decidir el codigo HTTP sin leer el texto', async () => {
    const fallo = await servicio
      .redeem({ resetId: 'no-existe', token: 'x', newPassword: CLAVE_NUEVA })
      .catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(PasswordResetError);
    expect((fallo as PasswordResetError).reason).toBe('token-invalido');
  });
});
