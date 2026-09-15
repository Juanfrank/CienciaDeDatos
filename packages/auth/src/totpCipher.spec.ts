import { describe, expect, it } from 'vitest';
import {
  TotpSecretUnreadable,
  decryptTotpSecret,
  encryptTotpSecret,
  isEncryptedTotpSecret,
} from './totpCipher';

/** Cifrado en reposo del secreto TOTP — seccion 4.7.2. */

const PEPPER = 'pimienta-de-prueba-larga-y-arbitraria';
const SECRET = 'JBSWY3DPEHPK3PXPJBSW';
const CUENTA = 'u-ana@poderjudicial.gob.do';

const contexto = { pepper: PEPPER, boundTo: CUENTA };

/** Las cuatro piezas del sobre: version, vector, sello y contenido. */
const partesDe = (sobre: string) => sobre.split('.') as [string, string, string, string];

describe('el sobre cifrado', () => {
  it('vuelve a dar el mismo secreto', () => {
    expect(decryptTotpSecret(encryptTotpSecret(SECRET, contexto), contexto)).toBe(SECRET);
  });

  it('no contiene el secreto, que es el motivo entero de que exista', () => {
    const sobre = encryptTotpSecret(SECRET, contexto);

    // Se mira el sobre entero y tambien lo que sale de deshacer el base64url: una comprobacion
    // sobre el texto del sobre sola pasaria aunque el secreto viajara dentro sin cifrar.
    expect(sobre).not.toContain(SECRET);
    const crudo = sobre
      .split('.')
      .slice(1)
      .map((parte) => Buffer.from(parte, 'base64url').toString('binary'))
      .join('');
    expect(crudo).not.toContain(SECRET);
  });

  it('es distinto cada vez, aunque el secreto y la cuenta sean los mismos', () => {
    const uno = encryptTotpSecret(SECRET, contexto);
    const otro = encryptTotpSecret(SECRET, contexto);

    // Dos cuentas con el mismo secreto no se pueden reconocer por el sobre.
    expect(uno).not.toBe(otro);
    expect(decryptTotpSecret(otro, contexto)).toBe(SECRET);
  });

  it('se distingue de un secreto en claro por su forma', () => {
    expect(isEncryptedTotpSecret(encryptTotpSecret(SECRET, contexto))).toBe(true);
    expect(isEncryptedTotpSecret(SECRET)).toBe(false);
  });
});

describe('lo que el sobre se niega a descifrar', () => {
  it('con otra pimienta', () => {
    const sobre = encryptTotpSecret(SECRET, contexto);

    expect(() => decryptTotpSecret(sobre, { pepper: 'otra-pimienta', boundTo: CUENTA })).toThrow(
      TotpSecretUnreadable,
    );
  });

  it('movido a otra cuenta', () => {
    const sobre = encryptTotpSecret(SECRET, contexto);

    // El correo va como dato autenticado: quien pueda escribir en el almacen no puede copiar el
    // segundo factor de una cuenta a otra.
    expect(() =>
      decryptTotpSecret(sobre, { pepper: PEPPER, boundTo: 'u-beto@poderjudicial.gob.do' }),
    ).toThrow(TotpSecretUnreadable);
  });

  it('con el contenido manipulado', () => {
    const [version, iv, tag, cuerpo] = partesDe(encryptTotpSecret(SECRET, contexto));
    const otroCuerpo = Buffer.from(cuerpo, 'base64url');
    otroCuerpo.writeUInt8(otroCuerpo.readUInt8(0) ^ 0xff, 0);

    expect(() =>
      decryptTotpSecret([version, iv, tag, otroCuerpo.toString('base64url')].join('.'), contexto),
    ).toThrow(TotpSecretUnreadable);
  });

  it('con el sello de autenticidad de otro sobre', () => {
    const [version, iv, , cuerpo] = partesDe(encryptTotpSecret(SECRET, contexto));
    const [, , ajeno] = partesDe(encryptTotpSecret(SECRET, contexto));

    expect(() => decryptTotpSecret([version, iv, ajeno, cuerpo].join('.'), contexto)).toThrow(
      TotpSecretUnreadable,
    );
  });

  it('en un formato de version que este despliegue no conoce', () => {
    const sobre = encryptTotpSecret(SECRET, contexto).replace(/^v1\./, 'v2.');

    // Un sobre de una version futura sigue siendo un sobre: se rechaza nombrando la version, y no
    // se confunde con un secreto en claro que habria que volver a cifrar.
    expect(isEncryptedTotpSecret(sobre)).toBe(true);
    expect(() => decryptTotpSecret(sobre, contexto)).toThrow(/'v2'/);
  });

  it('cuando lo que llega no es un sobre', () => {
    expect(() => decryptTotpSecret(SECRET, contexto)).toThrow(TotpSecretUnreadable);
  });
});

describe('la pimienta', () => {
  it('hace falta para cifrar y para descifrar', () => {
    expect(() => encryptTotpSecret(SECRET, { pepper: '', boundTo: CUENTA })).toThrow(
      TotpSecretUnreadable,
    );
    const sobre = encryptTotpSecret(SECRET, contexto);
    expect(() => decryptTotpSecret(sobre, { pepper: '', boundTo: CUENTA })).toThrow(
      TotpSecretUnreadable,
    );
  });

  it('deriva la clave, no se usa tal cual', () => {
    const sobre = encryptTotpSecret(SECRET, contexto);

    // La clave que cifra el segundo factor y la pimienta que sazona los hashes de contrasena son
    // independientes: la pimienta no aparece en el sobre por ninguna parte.
    expect(sobre).not.toContain(PEPPER);
    expect(sobre).not.toContain(Buffer.from(PEPPER).toString('base64url'));
  });
});
