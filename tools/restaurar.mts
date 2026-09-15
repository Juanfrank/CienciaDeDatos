/**
 * Devuelve al almacen un estado respaldado.
 *
 *   CACHE_DIR=/ruta/al/almacen npm run restaurar -- /ruta/al/respaldo.json            # en seco
 *   CACHE_DIR=/ruta/al/almacen npm run restaurar -- /ruta/al/respaldo.json --aplicar  # escribe
 *
 * EN SECO POR DEFECTO. Restaurar es lo que se hace el peor dia, con prisa y sin margen para
 * descubrir a mitad que el archivo no era el que se creia. Sin `--aplicar` no toca nada: dice
 * cuantas claves escribiria, cuales rechaza y por que.
 */
import { readFileSync } from 'node:fs';
import { restoreState, UnreadableBackup, type Backup } from '../apps/shell/src/server/backup';

const origen = process.argv[2];
const aplicar = process.argv.includes('--aplicar');

if (!origen) {
  console.error('Falta el archivo. Uso: npm run restaurar -- <archivo.json> [--aplicar]');
  process.exit(2);
}

let respaldo: Backup;
try {
  respaldo = JSON.parse(readFileSync(origen, 'utf8')) as Backup;
} catch (error) {
  console.error(`No se pudo leer ${origen}: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

try {
  const informe = await restoreState(respaldo, { apply: aplicar });

  console.log('');
  console.log(`  ${aplicar ? 'Restauradas' : 'Se restaurarian'} ${informe.written.length} claves.`);
  if (informe.rejected.length > 0) {
    console.log('');
    console.log(`  Rechazadas ${informe.rejected.length}, y es lo correcto:`);
    for (const { key, reason } of informe.rejected) console.log(`    ${key} — ${reason}`);
  }
  console.log('');
  if (!aplicar) {
    console.log('  Nada se ha escrito. Repita con --aplicar cuando el resumen cuadre.');
    console.log('');
  } else {
    // Lo primero que hay que hacer despues, dicho donde se acaba de hacer lo anterior.
    console.log('  Las credenciales locales NO estaban en el respaldo. Para volver a entrar:');
    console.log('    npm run crear-administrador -- <userId>');
    console.log('  y el resto de las cuentas, por restablecimiento mediado desde /admin/accounts.');
    console.log('');
  }
} catch (error) {
  if (error instanceof UnreadableBackup) {
    console.error(`No se restauro nada: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
