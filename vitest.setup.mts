import { cpSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Aislamiento del estado compartido en las pruebas.
 *
 * Desde que la sesion, el gobierno, los marcadores y la auditoria viven en el almacen
 * compartido, una prueba que escribe deja huella EN DISCO: sin esto, el gobierno que una prueba
 * modifica lo hereda la siguiente, y el `.cache-datos` de desarrollo se llena de estado de
 * pruebas. Cada proceso de vitest recibe su propio directorio.
 *
 * Los DATASETS poblados si se copian. Alguna prueba lee datos reales del cache —es
 * deliberado: comprueban el camino de lectura completo— y sin ellos no comprobarian nada.
 * Se copian, no se comparten, para que tampoco puedan escribirse encima.
 */
const destino = mkdtempSync(join(tmpdir(), 'capa-visualizacion-pruebas-'));
const source = process.env['CACHE_DIR'] ?? join(process.cwd(), '.cache-datos');

if (existsSync(source)) {
  for (const archivo of readdirSync(source)) {
    // `ds%3A` son datasets y `ops%3A` el latido y el esquema: todo lo que puebla el job.
    if (archivo.startsWith('ds%3A') || archivo.startsWith('ops%3A')) {
      cpSync(join(source, archivo), join(destino, archivo));
    }
  }
}

process.env['CACHE_DIR'] = destino;
