/**
 * Vuelca el estado autoritativo a un archivo.
 *
 * Es un comando de operacion y no una ruta HTTP por el mismo motivo que `crear-administrador`:
 * una ruta que entrega el gobierno entero es una puerta que queda abierta para siempre. Esto lo
 * ejecuta quien ya esta dentro de la maquina.
 *
 *   CACHE_DIR=/ruta/al/almacen npm run respaldo -- /ruta/al/respaldo.json
 *
 * Solo LEE. Lo que se lleva y lo que deja fuera esta declarado, con su motivo, en
 * `apps/shell/src/server/backup.ts`. No se lleva las credenciales locales: el archivo seria la
 * identidad local de toda la institucion en un sitio.
 */
import { writeFileSync } from 'node:fs';
import { backupState, CLASSES } from '../apps/shell/src/server/backup';

const destino = process.argv[2];

if (!destino) {
  console.error('Falta el destino. Uso: npm run respaldo -- <archivo.json>');
  process.exit(2);
}

const respaldo = await backupState();
writeFileSync(destino, `${JSON.stringify(respaldo, null, 2)}\n`);

console.log('');
console.log(`  Respaldo escrito en ${destino}`);
console.log(`  ${respaldo.manifest.keys} claves, tomadas ${respaldo.manifest.takenAt}`);
console.log('');
for (const [prefijo, cuantas] of Object.entries(respaldo.manifest.byPrefix)) {
  if (cuantas > 0) console.log(`    ${String(cuantas).padStart(4)}  ${prefijo}`);
}
console.log('');
// Se dice lo que NO va dentro, y aqui: quien lea esto es quien va a confiar en el archivo.
console.log('  Fuera del respaldo, a proposito:');
for (const { prefix, kind, reason } of CLASSES) {
  if (kind === 'no-respaldar') console.log(`    ${prefix} — ${reason}`);
}
console.log('');
console.log('  Sin AUTH_PEPPER este respaldo no sirve para volver a entrar.');
console.log('  Ver docs/operations/contingencia.md');
console.log('');
