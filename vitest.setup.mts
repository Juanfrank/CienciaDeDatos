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

/**
 * El origen se fija UNA vez por proceso, y eso es lo que lo hace correcto.
 *
 * Esto se ejecuta una vez por archivo de prueba, y con los procesos reutilizados
 * (`isolate: false`) el segundo archivo encontraba `CACHE_DIR` apuntando al directorio temporal
 * del primero — y copiaba los datasets DE AHI. Mientras nadie borraba nada no se notaba. Una
 * prueba que vacia el almacen para simular un disco perdido dejaba sin datos a la siguiente que
 * cayera en su mismo proceso, y el fallo aparecia en un archivo que no tenia nada que ver.
 */
const global = globalThis as typeof globalThis & { __fuenteDelCache?: string };
const source = (global.__fuenteDelCache ??=
  process.env['CACHE_DIR'] ?? join(process.cwd(), '.cache-datos'));

if (existsSync(source)) {
  for (const archivo of readdirSync(source)) {
    // `ds%3A` son datasets y `ops%3A` el latido y el esquema: todo lo que puebla el job.
    if (archivo.startsWith('ds%3A') || archivo.startsWith('ops%3A')) {
      cpSync(join(source, archivo), join(destino, archivo));
    }
  }
}

process.env['CACHE_DIR'] = destino;
