import type { ConfigChangeLog } from '@app/observability';
import { conAdmin } from '../guardia';
import { contarAmpliaciones, listarAuditoria } from '../../../../src/server/auditoria';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Registro de auditoria filtrable (4.10.7 y seccion 7).
 *
 * Devuelve ademas el numero de ampliaciones de ambito vigentes por separado. Es una metrica de
 * salud de gobierno, no de actividad: deberia tender a cero, y una tendencia creciente indica
 * que el modelo de RLS se esta relajando por acumulacion de excepciones.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType');

  return conAdmin(async () => ({
    eventos: await listarAuditoria({
      ...(entityType ? { entityType: entityType as ConfigChangeLog['entityType'] } : {}),
      ...(url.searchParams.get('soloAmpliaciones') === '1' ? { soloAmpliaciones: true } : {}),
      ...(url.searchParams.get('soloMovimientos') === '1' ? { soloMovimientos: true } : {}),
      ...(url.searchParams.get('actorId') ? { actorId: url.searchParams.get('actorId') as string } : {}),
    }),
    ampliacionesVigentes: await contarAmpliaciones(),
  }));
}
