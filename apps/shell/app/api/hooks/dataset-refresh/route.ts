import { NextResponse } from 'next/server';
import { datasetKeyPrefix, getDataset } from '@app/caching';
import { cacheL2 } from '../../../../src/server/contexto';

export const runtime = 'nodejs';

/**
 * Webhook de la capa de analisis — seccion 4.8.
 *
 * Lo invoca la capa de analisis al completar una carga incremental, para disparar la poblacion
 * dirigida del cache en vez de depender solo de la recurrencia programada.
 *
 * Lo que este endpoint NO hace, y es lo importante: consultar la fuente. Valida, invalida las
 * entradas afectadas y encola; quien consulta es el job (principio 2). Ejecutar la consulta
 * aqui la ataria al ciclo de vida de una solicitud HTTP, que es justo lo que 6.4 separa.
 */
export async function POST(request: Request) {
  const secreto = process.env['WEBHOOK_SECRET'];
  if (secreto && request.headers.get('x-webhook-secret') !== secreto) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const cuerpo = (await request.json()) as { datasetIds?: string[] };
  const datasetIds = cuerpo.datasetIds ?? [];

  if (datasetIds.length === 0) {
    return NextResponse.json({ error: 'Se requiere datasetIds.' }, { status: 400 });
  }

  const desconocidos: string[] = [];
  for (const datasetId of datasetIds) {
    try {
      getDataset(datasetId);
    } catch {
      desconocidos.push(datasetId);
    }
  }

  if (desconocidos.length > 0) {
    return NextResponse.json(
      { error: `Datasets no registrados: ${desconocidos.join(', ')}.` },
      { status: 400 },
    );
  }

  // Invalidacion dirigida por prefijo (6.5): solo lo afectado, no todo el cache.
  for (const datasetId of datasetIds) {
    await cacheL2.deleteByPrefix(datasetKeyPrefix(datasetId));
  }

  return NextResponse.json({ encolados: datasetIds, invalidados: datasetIds }, { status: 202 });
}
