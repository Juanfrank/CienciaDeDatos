import { withAdmin } from '../guardia';
import { AdminError, seesWhoWhere } from '../../../../src/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Vista de "quien ve que" (4.10.8). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const teamId = url.searchParams.get('teamId');
  const moduleId = url.searchParams.get('moduleId');

  return withAdmin(async () => {
    if (!userId || !teamId || !moduleId) {
      throw new AdminError('Se requieren userId, teamId y moduleId.', 400);
    }
    return await seesWhoWhere(userId, teamId, moduleId);
  });
}
