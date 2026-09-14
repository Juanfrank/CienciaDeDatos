import { withAdmin } from '../../../guardia';
import {
  AdminError,
  accessToModule,
  grantModuleToTeam,
  grantModuleToUser,
} from '../../../../../../src/server/admin';
import { modules } from '../../../../../../src/server/moduleStore';

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
  /** Para «equipo»: a que equipo. */
  teamId?: string;
  /** Para «persona»: a quien, a su nombre. */
  userId?: string;
  conceder: boolean;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json()) as AccessBody;

  return withAdmin(async (actor) => {
    const modulo = (await modules.list()).find((m) => m.slug === slug);
    if (!modulo) throw new AdminError('Modulo no encontrado.', 404);

    if (body.accion === 'equipo') {
      if (!body.teamId) throw new AdminError('Falta teamId.', 400);
      return {
        equipo: await grantModuleToTeam(actor, {
          moduleId: modulo.moduleId,
          teamId: body.teamId,
          conceder: body.conceder,
        }),
      };
    }

    /*
     * A una PERSONA se le concede a su nombre, no metiendola en un equipo.
     *
     * Meterla en un equipo concedia, pero de paso le daba todo lo demas de ese equipo, y el
     * registro decia «cambio de membresia» donde lo que habia pasado era «le dieron este modulo».
     * La concesion individual existe ahora en el modelo y la resolucion de navegacion la mira, asi
     * que este boton concede exactamente lo que dice.
     */
    if (!body.userId) throw new AdminError('Falta userId.', 400);
    return {
      persona: await grantModuleToUser(actor, {
        moduleId: modulo.moduleId,
        userId: body.userId,
        conceder: body.conceder,
      }),
    };
  });
}
