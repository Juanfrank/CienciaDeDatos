import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { datasetKeyPrefix, getDataset } from '@app/caching';
import { cacheL2 } from '../../../../src/server/context';

export const runtime = 'nodejs';

/**
 * Compara sin filtrar por el tiempo que tarda.
 *
 * Un `!==` sobre cadenas sale en cuanto encuentra el primer byte distinto, asi que el tiempo de
 * respuesta dice cuantos bytes se acertaron. Con suficientes intentos eso reconstruye el secreto
 * byte a byte. `timingSafeEqual` tarda lo mismo acierte o falle.
 */
function mismoSecreto(recibido: string | null, esperado: string): boolean {
  if (recibido === null) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  // Longitudes distintas no pasan por `timingSafeEqual`, que exige el mismo tamano.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook de la capa de analisis — seccion 4.8. */
export async function POST(request: Request) {
  const secreto = process.env['WEBHOOK_SECRET'];

  /*
   * Sin secreto configurado se RECHAZA, no se deja pasar.
   *
   * Antes la comprobacion era `if (secreto && ...)`: si la variable no estaba puesta, el webhook
   * quedaba abierto a cualquiera, y lo que hace es invalidar entradas del cache. Eso es un
   * disparador de recarga de la fuente a peticion de quien sea. Una puerta que solo cierra cuando
   * alguien se acuerda de darle la llave esta abierta.
   */
  if (!secreto) {
    return NextResponse.json(
      { error: 'El webhook no esta configurado en este entorno.' },
      { status: 503 },
    );
  }

  if (!mismoSecreto(request.headers.get('x-webhook-secret'), secreto)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = (await request.json()) as { datasetIds?: string[] };
  const datasetIds = body.datasetIds ?? [];

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
