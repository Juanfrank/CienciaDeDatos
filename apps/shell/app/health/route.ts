import { NextResponse } from 'next/server';
import { POPULATOR_HEARTBEAT_KEY, type PopulatorHeartbeat, buildHealthReport } from '@app/observability';
import { cacheL2, conectorActivo, metricasDeCache } from '../../src/server/contexto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Endpoint de salud — seccion 7. */
export async function GET() {
  let cacheStoreReachable = true;
  let heartbeat: PopulatorHeartbeat | null = null;

  try {
    heartbeat = (await cacheL2.get<PopulatorHeartbeat>(POPULATOR_HEARTBEAT_KEY))?.value ?? null;
  } catch {
    cacheStoreReachable = false;
  }

  const informe = buildHealthReport({
    configuredConnector: await conectorActivo(),
    cacheStoreReachable,
    // Sin base de identidad en este entorno: el gobierno se lee del seed en memoria.
    identityDbReachable: true,
    heartbeat,
  });

  return NextResponse.json(
    {
      ...informe,
      /** Metricas del camino de lectura (8.3), ACUMULADAS POR ESTA INSTANCIA. */
      cache: { instancia: process.pid, ...metricasDeCache.resumen() },
    },
    { status: informe.status === 'caido' ? 503 : 200 },
  );
}
