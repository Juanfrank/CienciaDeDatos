/**
 * Cifra en el almacen los secretos TOTP que quedaran en claro.
 *
 * La aplicacion cifra cada registro la primera vez que lo lee, asi que una cuenta que entra se
 * pone al dia sola. Una cuenta dormida no se lee nunca, y su secreto —que es una credencial
 * completa— seguiria en claro. Este comando las recorre todas.
 *
 *   CACHE_DIR=/ruta/al/almacen AUTH_PEPPER=... npm run cifrar-totp
 *
 * Es idempotente: volver a ejecutarlo sobre un almacen ya cifrado no cambia nada.
 */
import { encryptStoredTotpSecrets } from '../apps/shell/src/server/identity';

const pepper = process.env['AUTH_PEPPER'];

if (!pepper) {
  // Con otra pimienta los sobres que escriba este comando no los podria abrir la aplicacion, y
  // el segundo factor quedaria ilegible para todas las cuentas a la vez.
  console.error('Falta AUTH_PEPPER. Tiene que ser la MISMA con la que corre la aplicacion.');
  process.exit(2);
}

const { reviewed, migrated } = await encryptStoredTotpSecrets();

console.log('');
console.log(`  ${reviewed} credencial(es) revisada(s), ${migrated} cifrada(s) ahora.`);
console.log(
  migrated === 0
    ? '  No quedaba ningun secreto TOTP en claro.'
    : '  Los secretos ya no se pueden leer sin AUTH_PEPPER.',
);
console.log('');
