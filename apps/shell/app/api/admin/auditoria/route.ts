import type { ConfigChangeLog } from '@app/observability';
import { withAdmin } from '../guardia';
import { expansionsCount, auditList } from '../../../../src/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Registro de auditoria filtrable (4.10.7 y seccion 7). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType');

  return withAdmin(async () => ({
    eventos: await auditList({
      ...(entityType ? { entityType: entityType as ConfigChangeLog['entityType'] } : {}),
      ...(url.searchParams.get('onlyExpansions') === '1' ? { onlyExpansions: true } : {}),
      ...(url.searchParams.get('onlyMoves') === '1' ? { onlyMoves: true } : {}),
      ...(url.searchParams.get('actorId') ? { actorId: url.searchParams.get('actorId') as string } : {}),
    }),
    activeExpansions: await expansionsCount(),
  }));
}
