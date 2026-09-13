/** Lleva el estado de los modulos a Azure App Configuration — seccion 3.4. */
import { readFileSync } from 'node:fs';
import { DefaultAzureCredential } from '@azure/identity';
import { banderaDeModulo } from '@app/config';
import type { ModuleHealth } from '@app/module-model';

interface Informe {
  modulos: { slug: string; health: ModuleHealth }[];
}

const [, , rutaInforme, endpoint] = process.argv;
if (!rutaInforme || !endpoint) {
  console.error('Uso: aplicar-banderas.mts <informe.json> <https://tienda.azconfig.io>');
  process.exit(2);
}

const informe = JSON.parse(readFileSync(rutaInforme, 'utf8')) as Informe;
const credencial = new DefaultAzureCredential();
const token = await credencial.getToken('https://azconfig.io/.default');
if (!token) throw new Error('Sin token para App Configuration');

const base = endpoint.replace(/\/$/, '');
const cabeceras = {
  Authorization: `Bearer ${token.token}`,
  'Content-Type': 'application/vnd.microsoft.appconfig.kv+json',
};

let cambiadas = 0;

for (const modulo of informe.modulos) {
  const label = banderaDeModulo(modulo.slug);
  const cacheKey = encodeURIComponent(`.appconfig.featureflag/${label}`);
  const url = `${base}/kv/${cacheKey}?api-version=2023-11-01`;
  const debeEstarEncendido = modulo.health !== 'fallo';

  const actual = await fetch(url, { headers: { Authorization: cabeceras.Authorization } });
  if (actual.ok) {
    const body = (await actual.json()) as { value?: string };
    try {
      const vigente = JSON.parse(body.value ?? '{}') as { enabled?: boolean };
      // Sin cambio no se escribe: cada escritura es una revision en el historial de App
      // Configuration, y un despliegue que reescribe diez banderas identicas convierte ese
      // historial —que es donde se mira quien apago que y cuando— en ruido.
      if ((vigente.enabled !== false) === debeEstarEncendido) continue;
    } catch {
      // Un valor ilegible se reescribe: es justo lo que hay que corregir.
    }
  } else if (actual.status === 404 && debeEstarEncendido) {
    // Ausente ya significa encendido. Crear la bandera para decir «encendido» solo anade una
    // fila que no aporta.
    continue;
  }

  const respuesta = await fetch(url, {
    method: 'PUT',
    headers: cabeceras,
    body: JSON.stringify({
      value: JSON.stringify({
        id: label,
        description: `Modulo ${modulo.slug}`,
        enabled: debeEstarEncendido,
        conditions: { client_filters: [] },
      }),
      content_type: 'application/vnd.microsoft.appconfig.ff+json',
    }),
  });
  if (!respuesta.ok) {
    throw new Error(`No se pudo escribir ${label}: ${respuesta.status} ${respuesta.statusText}`);
  }

  cambiadas += 1;
  console.log(`${debeEstarEncendido ? 'encendido' : 'APAGADO'}: ${modulo.slug}`);
}

console.log(cambiadas === 0 ? 'Ninguna bandera cambio.' : `${cambiadas} bandera(s) actualizada(s).`);
