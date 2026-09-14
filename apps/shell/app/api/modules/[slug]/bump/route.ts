import { NextResponse } from 'next/server';
import {
  actorDe,
  bumpObjectInModule,
  visibleModuleSlug,
} from '../../../../../src/server/cicloDeVida';
import { errorResponse, withoutSession } from '../../../../../src/server/respuestas';
import { sessionGet } from '../../../../../src/server/session';

export const runtime = 'nodejs';

/** Sube las instancias de un objeto dentro de un modulo — seccion 4.5. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const modulo = await visibleModuleSlug(slug, actor);
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const objectId = body['objectId'];
  const hasta = body['hasta'];
  if (typeof objectId !== 'string' || typeof hasta !== 'string') {
    return NextResponse.json(
      { error: 'Se requieren el objeto y la version de destino.' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await bumpObjectInModule({ actor, moduleId: modulo.moduleId, objectId, hasta }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
