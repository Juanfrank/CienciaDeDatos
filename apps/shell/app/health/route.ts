import { NextResponse } from 'next/server';
import { POPULATOR_HEARTBEAT_KEY, type PopulatorHeartbeat, buildHealthReport } from '@app/observability';
import { CONNECTOR_KIND, cacheL2, metricasDeCache } from '../../src/server/contexto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint de salud — seccion 7.
 *
 * Reporta el conector activo SIN instanciar ninguno: lee el latido que el job de poblacion dejo
 * en el cache. Si el shell instanciara un conector para probar la conexion, abriria en el
 * proceso web justo el camino que el principio 2 cierra.
 */
export async function GET() {
  let cacheStoreReachable = true;
  let heartbeat: PopulatorHeartbeat | null = null;

  try {
    heartbeat = (await cacheL2.get<PopulatorHeartbeat>(POPULATOR_HEARTBEAT_KEY))?.value ?? null;
  } catch {
    cacheStoreReachable = false;
  }

  const informe = buildHealthReport({
    configuredConnector: CONNECTOR_KIND,
    cacheStoreReachable,
    // Sin base de identidad en este entorno: el gobierno se lee del seed en memoria.
    identityDbReachable: true,
    heartbeat,
  });

  return NextResponse.json(
    {
      ...informe,
      /**
       * Metricas del camino de lectura (8.3), ACUMULADAS POR ESTA INSTANCIA.
       *
       * Van aqui y no en un endpoint propio porque es el sitio que ya consulta quien opera, y
       * porque con varias instancias lo util es precisamente ver la de cada una: una sola
       * sirviendo degradado se pierde en cualquier agregado.
       */
      cache: { instancia: process.pid, ...metricasDeCache.resumen() },
    },
    { status: informe.status === 'caido' ? 503 : 200 },
  );
}
