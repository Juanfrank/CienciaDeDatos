/**
 * Crea el PRIMER Administrador de un despliegue.
 *
 * Es un comando de operacion y no una ruta HTTP a proposito: una ruta de arranque es una puerta
 * que queda abierta para siempre y de la que hay que acordarse de cerrar. Esto solo lo ejecuta
 * quien ya esta dentro de la maquina, que es la autoridad que hace falta para conceder el primer
 * acceso.
 *
 *   CACHE_DIR=/ruta/al/almacen AUTH_PEPPER=... npm run crear-administrador -- u-admin
 *
 * La contrasena se imprime UNA vez y no se guarda en ninguna parte. Si se pierde, se vuelve a
 * empezar por el procedimiento de acceso de emergencia.
 */
import { crearPrimerAdministrador, SinPoderCrearlo } from '../apps/shell/src/server/primerAdministrador';

const userId = process.argv[2];
const pepper = process.env['AUTH_PEPPER'];

if (!userId) {
  console.error('Falta el identificador. Uso: npm run crear-administrador -- <userId>');
  process.exit(2);
}
if (!pepper) {
  // Sin la pimienta el hash no verificaria al arrancar la aplicacion, y la cuenta quedaria
  // creada e inservible — que es peor que no crearla.
  console.error('Falta AUTH_PEPPER. Tiene que ser la MISMA con la que corre la aplicacion.');
  process.exit(2);
}

try {
  const creado = await crearPrimerAdministrador({ userId, pepper });
  console.log('');
  console.log('  Cuenta de Administrador creada.');
  console.log('');
  console.log(`  Correo:     ${creado.email}`);
  console.log(`  Contrasena: ${creado.clave}`);
  console.log(`  TOTP:       ${creado.totp}`);
  console.log('');
  console.log('  Se ensena UNA vez. Guardela ahora y entreguela en persona.');
  console.log('');
} catch (error) {
  if (error instanceof SinPoderCrearlo) {
    console.error(`No se creo: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
