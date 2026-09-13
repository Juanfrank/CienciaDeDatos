import type { ConfigChangeLog } from '@app/observability';
import { conAdmin } from '../guardia';
import { contarAmpliaciones, listarAuditoria } from '../../../../src/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Registro de auditoria filtrable (4.10.7 y seccion 7). */
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
