import { beforeEach, describe, expect, it } from 'vitest';
import { borrar } from './almacenCompartido';
import { credentialsStore, localesAccounts, mailUser } from './identity';
import { crearPrimerAdministrador, SinPoderCrearlo } from './primerAdministrador';

/**
 * El arranque de un despliegue sin ninguna cuenta local — seccion 4.7.2.
 *
 * Lo que se comprueba aqui no es que sepa escribir una credencial: es la negativa. Sin ella, este
 * comando seria una forma de fabricar administradores en una institucion que ya funciona, sin
 * pasar por el gobierno y sin que conste quien lo pidio.
 */

const PIMIENTA = 'pimienta-de-prueba';
const CLAVE = (userId: string) => `auth:credencial:${mailUser(userId).toLowerCase()}`;

beforeEach(async () => {
  for (const userId of ['u-admin', 'u-ana', 'u-beto', 'u-sin-equipo']) {
    await borrar(CLAVE(userId));
  }
});

describe('crear el primer Administrador', () => {
  it('crea UNA cuenta local, con clave y segundo factor', async () => {
    expect(await localesAccounts()).toEqual([]);

    const creado = await crearPrimerAdministrador({ userId: 'u-admin', pepper: PIMIENTA });

    expect(creado.userId).toBe('u-admin');
    // La clave y el secreto salen de `randomBytes`: lo unico que se puede afirmar es que existen y
    // que no son el valor de demostracion, que es publico y esta en el repositorio.
    expect(creado.clave.length).toBeGreaterThan(20);
    expect(creado.totp).toMatch(/^[A-Z2-7]{20}$/);

    const guardada = await credentialsStore.findByEmail(creado.email);
    expect(guardada?.totpSecret).toBe(creado.totp);
    // La clave EN CLARO no se guarda en ninguna parte: lo guardado es su hash.
    expect(JSON.stringify(guardada)).not.toContain(creado.clave);
  });

  it('se NIEGA si ya hay alguna cuenta local', async () => {
    await crearPrimerAdministrador({ userId: 'u-admin', pepper: PIMIENTA });

    /*
     * El segundo intento es con el MISMO usuario a proposito. Con otro, la negativa que se quiere
     * comprobar quedaria tapada: el gobierno sembrado solo tiene un Administrador, asi que
     * cualquier otro userId lo rechazaria la comprobacion de rol y la prueba pasaria igual con la
     * negativa desactivada. Con 'u-admin' —conocido y Administrador— lo unico que puede rechazarlo
     * es que ya haya una cuenta local, y por eso se afirma sobre ESE mensaje y no sobre la clase.
     */
    const segundo = crearPrimerAdministrador({ userId: 'u-admin', pepper: PIMIENTA });
    await expect(segundo).rejects.toBeInstanceOf(SinPoderCrearlo);
    await expect(segundo).rejects.toThrow(/Ya hay 1 cuenta\(s\) local\(es\)/);
  });

  it('no concede el ROL, solo el acceso: a quien no administra se le niega', async () => {
    /*
     * Conceder las dos cosas a la vez convertiria un comando de arranque en una forma de fabricar
     * autoridad, y quien administra la maquina no es necesariamente quien decide quien gobierna la
     * institucion.
     */
    await expect(
      crearPrimerAdministrador({ userId: 'u-ana', pepper: PIMIENTA }),
    ).rejects.toThrow(/no es Administrador/);
    expect(await localesAccounts()).toEqual([]);
  });

  it('un usuario que el gobierno no conoce tampoco', async () => {
    await expect(
      crearPrimerAdministrador({ userId: 'u-inventado', pepper: PIMIENTA }),
    ).rejects.toThrow(/ningun usuario/);
  });
});
