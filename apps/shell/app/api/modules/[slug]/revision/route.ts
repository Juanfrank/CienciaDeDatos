import { NextResponse } from 'next/server';
import { actorDe, createRevision } from '../../../../../src/server/cicloDeVida';
import { modules } from '../../../../../src/server/moduleStore';
import { errorResponse, withoutSession } from '../../../../../src/server/respuestas';
import { sessionGet } from '../../../../../src/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Abre una revision de un modulo publicado — seccion 4.1.
 *
 * Es la accion «editar» de la tabla de modulos, y lo que devuelve es un BORRADOR NUEVO: el modulo
 * publicado se sigue sirviendo mientras tanto, y el cambio pasa por la misma aprobacion que
 * cualquier otra propuesta.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const modulo = await modules.bySlug(slug);
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  try {
    return NextResponse.json(
      { modulo: await createRevision({ actor: await actorDe(sesion), moduleId: modulo.moduleId }) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
