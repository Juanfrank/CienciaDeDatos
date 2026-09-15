import { describe, expect, it } from 'vitest';
import { cookiePolicy, equalTokens, exemptPath, safeMethod, tokenOf } from './csrf';

/**
 * El token anti-CSRF y la politica de cookies — apartado 2.16.
 *
 * Lo que se comprueba aqui es lo que hace que la incrustacion en otro dominio se pueda encender
 * sin quedarse sin proteccion: que el token ate la peticion a SU sesion, y que las dos cookies
 * salgan siempre con la misma politica.
 */

const PIMIENTA = 'pimienta-de-prueba';

describe('el token de una sesion', () => {
  it('es el mismo para la misma sesion y distinto para otra', async () => {
    const una = await tokenOf('s-1', PIMIENTA);
    const otra = await tokenOf('s-2', PIMIENTA);

    // Sin esto no serviria de nada: quien tuviera un token valdria para cualquier sesion.
    expect(una).not.toBe(otra);
    expect(await tokenOf('s-1', PIMIENTA)).toBe(una);
  });

  it('cambia si cambia el secreto del servidor', async () => {
    // Es lo que impide falsificarlo: sin el secreto no se puede calcular.
    expect(await tokenOf('s-1', PIMIENTA)).not.toBe(await tokenOf('s-1', 'otra-pimienta'));
  });

  it('no lleva caracteres que una cookie no admita', async () => {
    expect(await tokenOf('s-1', PIMIENTA)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('la comparacion', () => {
  it('distingue, y no se para en el primer caracter distinto', () => {
    expect(equalTokens('abc', 'abc')).toBe(true);
    expect(equalTokens('abc', 'abd')).toBe(false);
    expect(equalTokens('abc', 'abcd')).toBe(false);
    expect(equalTokens('', '')).toBe(true);
  });
});

describe('que pasa por la puerta', () => {
  it('lo que no cambia nada no necesita token', () => {
    expect(safeMethod('GET')).toBe(true);
    expect(safeMethod('head')).toBe(true);
    expect(safeMethod('POST')).toBe(false);
    expect(safeMethod('DELETE')).toBe(false);
  });

  it('solo estan exentas las rutas que no pueden tener token', () => {
    // Entrar es de donde SALE el token; el restablecimiento lo ejecuta quien no tiene sesion.
    expect(exemptPath('/api/sign-in')).toBe(true);
    expect(exemptPath('/api/reset')).toBe(true);

    // Todo lo demas pasa por la puerta, incluida una ruta que EMPIECE igual: la comprobacion es
    // por segmento y no por prefijo, o `/api/sign-in-de-otra-cosa` entraria gratis.
    expect(exemptPath('/api/modules/x/edit')).toBe(false);
    expect(exemptPath('/api/admin/teams')).toBe(false);
    expect(exemptPath(`${'/api/sign-in'}-de-otra-cosa`)).toBe(false);
  });
});

describe('la politica de las cookies', () => {
  /*
   * Un navegador RECHAZA `SameSite=None` sin `Secure`. En desarrollo no hay HTTPS, asi que
   * ponerlo dejaria la aplicacion sin sesion: no relajaria la proteccion, la romperia entera.
   */
  it('sin produccion no se cruza de sitio, aunque haya portal declarado', () => {
    expect(
      cookiePolicy({ embedOrigins: 'https://portal.gob.do', nodeEnv: 'development' }),
    ).toEqual({ sameSite: 'lax', secure: false });
  });

  it('sin portal declarado se queda en lax, que es una capa mas gratis', () => {
    expect(cookiePolicy({ nodeEnv: 'production' })).toEqual({ sameSite: 'lax', secure: true });
    expect(cookiePolicy({ embedOrigins: '   ', nodeEnv: 'production' })).toEqual({
      sameSite: 'lax',
      secure: true,
    });
  });

  it('con portal declarado y en produccion, la cookie cruza — y siempre con secure', () => {
    expect(
      cookiePolicy({ embedOrigins: 'https://portal.gob.do', nodeEnv: 'production' }),
    ).toEqual({ sameSite: 'none', secure: true });
  });
});
