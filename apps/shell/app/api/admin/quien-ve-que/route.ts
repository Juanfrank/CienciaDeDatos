import { conAdmin } from '../guardia';
import { AdminError, quienVeQue } from '../../../../src/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vista de "quien ve que" (4.10.8).
 *
 * Dado un usuario, un equipo y un modulo, devuelve el ambito efectivo resuelto y la traza de
 * como se llego a el, incluyendo QUE CARPETA origino cada capa. Sirve para auditar y depurar una
 * configuracion ANTES de publicarla, que es justo lo que el documento pide.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const teamId = url.searchParams.get('teamId');
  const moduleId = url.searchParams.get('moduleId');

  return conAdmin(async () => {
    if (!userId || !teamId || !moduleId) {
      throw new AdminError('Se requieren userId, teamId y moduleId.', 400);
    }
    return await quienVeQue(userId, teamId, moduleId);
  });
}
