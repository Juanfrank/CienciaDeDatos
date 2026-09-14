import { NextResponse } from 'next/server';
import {
  actorDe,
  publicationLocks,
  createDraft,
  visibleModules,
} from '../../../src/server/cicloDeVida';
import { errorResponse, withoutSession } from '../../../src/server/respuestas';
import { sessionGet } from '../../../src/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Modulos del editor — secciones 4.1 y 4.2. */
export async function GET() {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const actor = await actorDe(sesion);
  const visibles = await visibleModules(actor);

  return NextResponse.json({
    role: actor.role,
    modules: await Promise.all(
      visibles.map(async (m) => ({
        moduleId: m.moduleId,
        slug: m.slug,
        name: m.name,
        status: m.status,
        version: m.version,
        autor: m.ownerUserId ?? null,
        own: m.ownerUserId === actor.userId,
        updatedAt: m.updatedAt,
        // Los bloqueos viajan con la lista para que la interfaz pueda deshabilitar "Enviar a
        // aprobacion" y decir por que, en vez de ofrecer un boton que siempre falla.
        locks: m.status === 'publicado' ? [] : await publicationLocks(m),
      })),
    ),
  });
}

export async function POST(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  try {
    const modulo = await createDraft({
      actor: await actorDe(sesion),
      name: typeof body['nombre'] === 'string' ? body['nombre'] : '',
      slug: typeof body['slug'] === 'string' ? body['slug'] : '',
    });
    return NextResponse.json({ modulo }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
