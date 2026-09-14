import type { AppRole, Team } from '@app/access-control';
import { withAdmin } from '../guardia';
import {
  AdminError,
  administradores,
  deleteTeam,
  membershipChange,
  saveTeam,
} from '../../../../src/server/admin';
import { listTeams, listUsers } from '../../../../src/server/context';
import { governance } from '../../../../src/server/governance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Equipos y personas, para el CRUD y la gestion de membresia (4.10.2). */
export async function GET() {
  return withAdmin(async () => ({
    equipos: await listTeams(),
    usuarios: (await listUsers()).map((u) => u.userId),
    paquetes: (await governance.listPackages()).map((p) => ({ id: p.id, name: p.name })),
    // Quienes administran ahora mismo. La emergencia que describe el procedimiento de acceso de
    // emergencia ocurre porque habia menos de dos, y eso no se ve en ningun sitio.
    administradores: await administradores(),
  }));
}

interface TeamBody {
  accion: 'guardar' | 'membresia' | 'borrar';
  equipo?: Team;
  teamId?: string;
  userId?: string;
  /** null quita a la persona del equipo. */
  role?: AppRole | null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as TeamBody;

  return withAdmin(async (actor) => {
    switch (body.accion) {
      case 'guardar': {
        if (!body.equipo) throw new AdminError('Falta el equipo.', 400);
        return { equipo: await saveTeam(actor, body.equipo) };
      }
      case 'membresia': {
        if (!body.teamId || !body.userId) {
          throw new AdminError('Faltan teamId y userId.', 400);
        }
        return {
          equipo: await membershipChange(actor, body.teamId, body.userId, body.role ?? null),
        };
      }
      case 'borrar': {
        if (!body.teamId) throw new AdminError('Falta teamId.', 400);
        // Pasa por el servicio y no por el almacen: alli esta la comprobacion del ultimo
        // Administrador y el registro de auditoria, que este handler se saltaba.
        await deleteTeam(actor, body.teamId);
        return { borrado: body.teamId };
      }
      default:
        throw new AdminError('Accion desconocida.', 400);
    }
  });
}
