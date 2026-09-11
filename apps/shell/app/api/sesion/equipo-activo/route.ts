import { NextResponse } from 'next/server';
import { teamsOf } from '../../../../src/server/contexto';
import { COOKIE_SESION, cambiarEquipoActivo, cambiarUsuario, obtenerSesion } from '../../../../src/server/sesion';

export const runtime = 'nodejs';

/**
 * Cambio de equipo activo (4.10.2).
 *
 * Es una accion explicita de la persona usuaria y una escritura del lado servidor: el ambito de
 * datos efectivo cambia de inmediato SIN cerrar sesion.
 *
 * Comprueba que la persona pertenece al equipo. Sin esa comprobacion, cualquiera podria fijar
 * un teamId arbitrario con una peticion a mano y leer los datos de otro equipo — el caso
 * exacto que la seccion 9 pide probar a nivel de backend, no de interfaz.
 */
export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  const cuerpo = (await request.json()) as { teamId?: string; userId?: string };

  let actualizada = sesion;

  if (cuerpo.userId) {
    const cambiada = await cambiarUsuario(sesion.sessionId, cuerpo.userId);
    if (!cambiada) return NextResponse.json({ error: 'Sesion no valida.' }, { status: 401 });
    actualizada = cambiada;
  }

  if (cuerpo.teamId) {
    const permitidos = (await teamsOf(actualizada.userId)).map((t) => t.id);
    if (!permitidos.includes(cuerpo.teamId)) {
      return NextResponse.json(
        { error: 'No pertenece a ese equipo.' },
        { status: 403 },
      );
    }
    const cambiada = await cambiarEquipoActivo(actualizada.sessionId, cuerpo.teamId);
    if (!cambiada) return NextResponse.json({ error: 'Sesion no valida.' }, { status: 401 });
    actualizada = cambiada;
  }

  const respuesta = NextResponse.json({
    userId: actualizada.userId,
    equipoActivo: actualizada.activeTeamId,
  });
  respuesta.cookies.set(COOKIE_SESION, actualizada.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return respuesta;
}
