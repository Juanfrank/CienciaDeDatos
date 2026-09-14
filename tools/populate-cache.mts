/** Puebla el cache local contra el conector configurado, para desarrollo y pruebas. */
import { createDataConnector, isConnectorKind } from '@app/data-contracts-server';
import { FileCacheStore } from '@app/caching';
import { runScheduledCycle } from '@app/cache-populator';

const args = process.argv.slice(2);
const read = (bandera: string, pordefecto: string): string => {
  const i = args.indexOf(bandera);
  return i >= 0 ? (args[i + 1] ?? pordefecto) : pordefecto;
};

const kind = read('--connector', process.env.DATA_CONNECTOR ?? 'mock');
if (!isConnectorKind(kind)) {
  console.error(`Conector desconocido: '${kind}'. Use mock, sql o xmla.`);
  process.exit(1);
}

const directory = read('--dir', process.env.CACHE_DIR ?? '.cache-datos');

// Cambiar de conector es UN valor de configuracion. Este archivo es el unico sitio donde se
// decide, y ni el shell ni los objetos visuales cambian una linea (criterio 2.4).
const connector = createDataConnector({
  kind,
  sql: { server: 'pendiente', database: 'pendiente' },
  xmla: { endpoint: 'pendiente', catalog: 'pendiente' },
});

const resultado = await runScheduledCycle({
  connector,
  cacheStore: new FileCacheStore({ directory }),
  connectorKind: kind,
  onQueryLog: (log) => {
    console.log(
      `[${log.outcome}] ${log.datasetId} via ${log.connector} ` +
        `(${log.durationMs} ms${log.rowCount === undefined ? '' : `, ${log.rowCount} filas`})` +
        `${log.error ? ` — ${log.error}` : ''}`,
    );
  },
});

const { heartbeat, skipped, schemaRefreshed } = resultado;
console.log('');
console.log(`Conector:      ${heartbeat.connector} (alcanzable: ${heartbeat.connectorReachable})`);
console.log(`Datasets:      ${heartbeat.datasets.length} procesados, ${skipped.length} saltados`);
console.log(`Esquema:       ${schemaRefreshed ? 'refrescado' : 'sin cambios'}`);
console.log(`Directorio:    ${directory}`);

const fallidos = heartbeat.datasets.filter((d) => d.outcome === 'fallo');
if (fallidos.length > 0) {
  console.log('');
  console.log(`${fallidos.length} dataset(s) fallaron. El cache conserva la ultima version valida.`);
  process.exitCode = 1;
}
