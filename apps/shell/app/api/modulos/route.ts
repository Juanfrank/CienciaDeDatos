import { NextResponse } from 'next/server';
import {
  actorDe,
  bloqueosDePublicacion,
  crearBorrador,
  modulosVisibles,
} from '../../../src/server/cicloDeVida';
import { respuestaDeError, sinSesion } from '../../../src/server/respuestas';
import { obtenerSesion } from '../../../src/server/sesion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Modulos del editor — secciones 4.1 y 4.2. */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const actor = await actorDe(sesion);
  const visibles = await modulosVisibles(actor);

  return NextResponse.json({
    rol: actor.role,
    modulos: await Promise.all(
      visibles.map(async (m) => ({
        moduleId: m.moduleId,
        slug: m.slug,
        name: m.name,
        status: m.status,
        version: m.version,
        autor: m.ownerUserId ?? null,
        propio: m.ownerUserId === actor.userId,
        updatedAt: m.updatedAt,
        // Los bloqueos viajan con la lista para que la interfaz pueda deshabilitar "Enviar a
        // aprobacion" y decir por que, en vez de ofrecer un boton que siempre falla.
        bloqueos: m.status === 'publicado' ? [] : await bloqueosDePublicacion(m),
      })),
    ),
  });
}

export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  try {
    const modulo = await crearBorrador({
      actor: await actorDe(sesion),
      name: typeof cuerpo['nombre'] === 'string' ? cuerpo['nombre'] : '',
      slug: typeof cuerpo['slug'] === 'string' ? cuerpo['slug'] : '',
    });
    return NextResponse.json({ modulo }, { status: 201 });
  } catch (error) {
    return respuestaDeError(error);
  }
}
