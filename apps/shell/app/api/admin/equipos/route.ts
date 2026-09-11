import type { AppRole, Team } from '@app/access-control';
import { conAdmin } from '../guardia';
import { AdminError, cambiarMembresia, guardarEquipo } from '../../../../src/server/admin';
import { listTeams, listUsers } from '../../../../src/server/contexto';
import { gobierno } from '../../../../src/server/gobierno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Equipos y personas, para el CRUD y la gestion de membresia (4.10.2). */
export async function GET() {
  return conAdmin(() => ({
    equipos: listTeams(),
    usuarios: listUsers().map((u) => u.userId),
    paquetes: gobierno.listPackages().map((p) => ({ id: p.id, name: p.name })),
  }));
}

interface CuerpoEquipo {
  accion: 'guardar' | 'membresia' | 'borrar';
  equipo?: Team;
  teamId?: string;
  userId?: string;
  /** null quita a la persona del equipo. */
  role?: AppRole | null;
}

export async function POST(request: Request) {
  const cuerpo = (await request.json()) as CuerpoEquipo;

  return conAdmin((actor) => {
    switch (cuerpo.accion) {
      case 'guardar': {
        if (!cuerpo.equipo) throw new AdminError('Falta el equipo.', 400);
        return { equipo: guardarEquipo(actor, cuerpo.equipo) };
      }
      case 'membresia': {
        if (!cuerpo.teamId || !cuerpo.userId) {
          throw new AdminError('Faltan teamId y userId.', 400);
        }
        return {
          equipo: cambiarMembresia(actor, cuerpo.teamId, cuerpo.userId, cuerpo.role ?? null),
        };
      }
      case 'borrar': {
        if (!cuerpo.teamId) throw new AdminError('Falta teamId.', 400);
        const borrado = gobierno.deleteTeam(cuerpo.teamId);
        if (!borrado) throw new AdminError(`El equipo '${cuerpo.teamId}' no existe.`, 404);
        return { borrado: cuerpo.teamId };
      }
      default:
        throw new AdminError('Accion desconocida.', 400);
    }
  });
}
