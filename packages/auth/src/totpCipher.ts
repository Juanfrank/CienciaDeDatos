import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Cifrado en reposo del secreto TOTP — seccion 4.7.2.
 *
 * El secreto TOTP es una credencial completa: quien lo lee genera codigos validos indefinidamente.
 * No se puede hashear como la contrasena, porque verificar un codigo exige el secreto original, de
 * modo que la unica proteccion posible es cifrarlo con una clave que no viva junto a el.
 *
 * La clave se DERIVA de la pimienta de aplicacion y no se guarda en ningun sitio. Un volcado del
 * almacen, por si solo, no contiene nada con lo que descifrar — la misma propiedad que la pimienta
 * le da a los hashes de contrasena.
 */

/** Etiqueta de version del sobre. Un cambio de formato sube este numero. */
const VERSION = 'v1';

/**
 * Sal y etiqueta de la derivacion HKDF.
 *
 * La etiqueta separa esta clave de cualquier otro uso de la misma pimienta: la que cifra el
 * segundo factor y la que sazona los hashes de contrasena son independientes aunque nazcan del
 * mismo secreto. La sal de HKDF no necesita ser secreta.
 */
const SALT = 'capa-de-visualizacion/auth';
const INFO = 'totp-secret-encryption/v1';

const KEY_BYTES = 32;
const IV_BYTES = 12;

/** El sobre, tal y como se guarda: `v1.<iv>.<tag>.<ciphertext>` en base64url. */
const ENVELOPE = /^v\d+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Un secreto que no se puede leer.
 *
 * Se lanza en vez de devolver vacio a proposito: quien consume el registro decide si exigir el
 * segundo factor por la PRESENCIA del secreto, asi que un secreto ilegible convertido en ausente
 * seria una cuenta que entra sin segundo factor. Falla cerrado.
 */
export class TotpSecretUnreadable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TotpSecretUnreadable';
  }
}

export interface TotpCipherContext {
  /** La pimienta de aplicacion, de Azure Key Vault (4.7.2). */
  pepper: string;
  /**
   * A que registro pertenece el secreto — el correo de la cuenta.
   *
   * Viaja como datos autenticados del cifrado, no dentro de el: un sobre movido de una cuenta a
   * otra no descifra, aunque quien lo mueva tenga acceso de escritura al almacen.
   */
  boundTo: string;
}

function keyFrom(pepper: string): Buffer {
  if (!pepper) {
    throw new TotpSecretUnreadable(
      'El cifrado del secreto TOTP necesita la pimienta de aplicacion (4.7.2).',
    );
  }
  return Buffer.from(hkdfSync('sha256', pepper, SALT, INFO, KEY_BYTES));
}

const aad = (boundTo: string): Buffer => Buffer.from(boundTo.toLowerCase(), 'utf8');

/** Si un valor guardado ya es un sobre cifrado. Un secreto en base32 nunca lleva puntos. */
export const isEncryptedTotpSecret = (value: string): boolean => ENVELOPE.test(value);

export function encryptTotpSecret(secret: string, context: TotpCipherContext): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(context.pepper), iv);
  cipher.setAAD(aad(context.boundTo));

  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    body.toString('base64url'),
  ].join('.');
}

export function decryptTotpSecret(envelope: string, context: TotpCipherContext): string {
  if (!isEncryptedTotpSecret(envelope)) {
    throw new TotpSecretUnreadable('El secreto TOTP guardado no tiene forma de sobre cifrado.');
  }

  const [version, iv, tag, body] = envelope.split('.') as [string, string, string, string];
  if (version !== VERSION) {
    throw new TotpSecretUnreadable(
      `El secreto TOTP esta en formato '${version}' y este despliegue solo lee '${VERSION}'.`,
    );
  }

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFrom(context.pepper),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(aad(context.boundTo));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    /*
     * El mensaje no distingue pimienta equivocada de sobre manipulado, y no lleva nada del
     * contenido: las tres causas se arreglan mirando el despliegue, no el registro.
     */
    throw new TotpSecretUnreadable(
      'No se pudo descifrar el secreto TOTP: la pimienta no es la que lo cifro, o el registro ' +
        'se modifico fuera de la aplicacion.',
    );
  }
}
