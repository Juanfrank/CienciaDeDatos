/**
 * El codigo de segundo factor de las cuentas de demostracion, ahora mismo.
 *
 * Las tres cuentas sembradas comparten secreto TOTP, y el secreto esta escrito en la guia para
 * que cualquiera lo meta en su aplicacion de autenticacion. Eso funciona, pero pide instalar una
 * aplicacion y confiar en que el reloj del telefono y el del servidor coincidan — y cuando no
 * coinciden, lo unico que se ve es «El codigo de verificacion no es valido», que no dice por que.
 *
 * Esto lo calcula con el MISMO reloj que va a validarlo, porque corre en la misma maquina. Si el
 * reloj esta torcido, lo esta para los dos a la vez y el codigo entra igual.
 */
import { SECRETO_TOTP_DEMO, totpCodeOf } from '../apps/shell/src/server/demoCredentials';

const ahora = new Date();
const restan = 30 - (Math.floor(ahora.getTime() / 1000) % 30);

// El codigo va SOLO por la salida estandar y el aviso por la de error: asi `npm run demo-code
// --silent` se puede encadenar con otra orden sin que la coletilla se cuele en ella.
console.error(`(vale ${restan} segundo${restan === 1 ? '' : 's'} mas)`);
console.log(totpCodeOf(SECRETO_TOTP_DEMO, ahora));
