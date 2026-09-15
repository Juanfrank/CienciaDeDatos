import { NextResponse } from 'next/server';
import { POPULATOR_HEARTBEAT_KEY, type PopulatorHeartbeat, buildHealthReport } from '@app/observability';
import { cacheL2, activeConnector, metricasDeCache } from '../../src/server/context';
import { stateStatus } from '../../src/server/installation';

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

  // Si el almacen no responde no se puede saber que le paso al estado, y decir que se perdio
  // seria confundir «no lo alcanzo» con «no esta»: lo primero ya lo reporta `cache-l2`.
  const estado: Awaited<ReturnType<typeof stateStatus>> = cacheStoreReachable
    ? await stateStatus()
    : { status: 'en-marcha', missing: [] };

  const informe = buildHealthReport({
    configuredConnector: await activeConnector(),
    cacheStoreReachable,
    // Sin base de identidad en este entorno: el gobierno se lee del seed en memoria.
    identityDbReachable: true,
    stateStatus: estado.status,
    missingState: estado.missing,
    heartbeat,
  });

  return NextResponse.json(
    {
      ...informe,
      /** Metricas del camino de lectura (8.3), ACUMULADAS POR ESTA INSTANCIA. */
      cache: { objectInstance: process.pid, ...metricasDeCache.resumen() },
    },
    { status: informe.status === 'caido' ? 503 : 200 },
  );
}
