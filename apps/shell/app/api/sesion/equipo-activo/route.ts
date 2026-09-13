import { NextResponse } from 'next/server';
import { teamsOf } from '../../../../src/server/contexto';
import { sinSesion } from '../../../../src/server/respuestas';
import { cambiarEquipoActivo, obtenerSesion } from '../../../../src/server/sesion';

export const runtime = 'nodejs';

/** Cambio de equipo activo (4.10.2). */
export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const cuerpo = (await request.json()) as { teamId?: string };
  if (!cuerpo.teamId) {
    return NextResponse.json({ error: 'Se requiere teamId.' }, { status: 400 });
  }

  const permitidos = (await teamsOf(sesion.userId)).map((t) => t.id);
  if (!permitidos.includes(cuerpo.teamId)) {
    return NextResponse.json({ error: 'No pertenece a ese equipo.' }, { status: 403 });
  }

  const actualizada = await cambiarEquipoActivo(sesion.sessionId, cuerpo.teamId);
  if (!actualizada) return sinSesion();

  // La cookie no cambia: el identificador de sesion es el mismo y el equipo activo vive del lado
  // servidor. Reemitirla aqui solo serviria para que pareciera que el cambio es del navegador.
  return NextResponse.json({
    userId: actualizada.userId,
    equipoActivo: actualizada.activeTeamId,
  });
}
