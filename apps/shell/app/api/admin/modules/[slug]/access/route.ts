import { withAdmin } from '../../../guardia';
import { AdminError, accessToModule, grantModuleToTeam, membershipChange } from '../../../../../../src/server/admin';
import { modules } from '../../../../../../src/server/moduleStore';
import type { AppRole } from '@app/access-control';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Quien alcanza un modulo, y concederlo o revocarlo — secciones 4.10.6 y 4.10.8. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withAdmin(async () => {
    const modulo = (await modules.list()).find((m) => m.slug === slug);
    if (!modulo) throw new AdminError('Modulo no encontrado.', 404);
    return await accessToModule(modulo.moduleId);
  });
}

interface AccessBody {
  accion: 'equipo' | 'persona';
  teamId: string;
  /** Solo para «persona»: a quien se anade o se quita del equipo. */
  userId?: string;
  role?: AppRole;
  conceder: boolean;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json()) as AccessBody;

  return withAdmin(async (actor) => {
    const modulo = (await modules.list()).find((m) => m.slug === slug);
    if (!modulo) throw new AdminError('Modulo no encontrado.', 404);

    if (body.accion === 'equipo') {
      return {
        equipo: await grantModuleToTeam(actor, {
          moduleId: modulo.moduleId,
          teamId: body.teamId,
          conceder: body.conceder,
        }),
      };
    }

    /*
     * A una PERSONA se le da acceso metiendola en un equipo que ya lo tiene.
     *
     * No hay concesion directa a una persona, y no se inventa una aqui: seria un segundo camino
     * de acceso que `resolveEffectiveScope` no consulta, y entonces la pantalla diria que alguien
     * ve algo que en realidad no ve. La pertenencia es el camino que el modelo ya tiene, con su
     * rol y su auditoria.
     */
    if (!body.userId) throw new AdminError('Falta userId.', 400);
    return {
      equipo: await membershipChange(
        actor,
        body.teamId,
        body.userId,
        body.conceder ? (body.role ?? 'visor') : null,
      ),
    };
  });
}
