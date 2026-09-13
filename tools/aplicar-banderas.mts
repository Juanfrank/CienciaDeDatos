/**
 * Lleva el estado de los modulos a Azure App Configuration — seccion 3.4.
 *
 * Es el paso que convierte el informe en efecto: el modulo que no se puede componer queda APAGADO
 * antes del swap, y los demas se despliegan. Sin esto, «un error en un modulo no bloquea a los
 * demas» seria cierto solo en el build y falso en produccion, donde el modulo roto seguiria
 * ofreciendose en el arbol para dar un error al pulsarlo.
 *
 * Escribe SOLO lo que cambia, y en las dos direcciones: apaga lo caido y **vuelve a encender lo
 * que se recupero**. Un interruptor que solo sabe apagar deja el modulo arreglado invisible hasta
 * que alguien se acuerde de ir a Azure, y eso convierte cada arreglo en dos tareas.
 *
 *   npx tsx tools/aplicar-banderas.mts estado-de-modulos.json https://<tienda>.azconfig.io
 *
 * La credencial sale de `DefaultAzureCredential`: en CI la resuelve la federacion de `azure/login`,
 * en una maquina la sesion de `az login`. No hay ninguna cadena de conexion que guardar.
 */
import { readFileSync } from 'node:fs';
import { DefaultAzureCredential } from '@azure/identity';
import { banderaDeModulo } from '@app/config';
import type { SaludDeModulo } from '@app/module-model';

interface Informe {
  modulos: { slug: string; salud: SaludDeModulo }[];
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
  const nombre = banderaDeModulo(modulo.slug);
  const clave = encodeURIComponent(`.appconfig.featureflag/${nombre}`);
  const url = `${base}/kv/${clave}?api-version=2023-11-01`;
  const debeEstarEncendido = modulo.salud !== 'fallo';

  const actual = await fetch(url, { headers: { Authorization: cabeceras.Authorization } });
  if (actual.ok) {
    const cuerpo = (await actual.json()) as { value?: string };
    try {
      const vigente = JSON.parse(cuerpo.value ?? '{}') as { enabled?: boolean };
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
        id: nombre,
        description: `Modulo ${modulo.slug}`,
        enabled: debeEstarEncendido,
        conditions: { client_filters: [] },
      }),
      content_type: 'application/vnd.microsoft.appconfig.ff+json',
    }),
  });
  if (!respuesta.ok) {
    throw new Error(`No se pudo escribir ${nombre}: ${respuesta.status} ${respuesta.statusText}`);
  }

  cambiadas += 1;
  console.log(`${debeEstarEncendido ? 'encendido' : 'APAGADO'}: ${modulo.slug}`);
}

console.log(cambiadas === 0 ? 'Ninguna bandera cambio.' : `${cambiadas} bandera(s) actualizada(s).`);
