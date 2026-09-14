import { NextResponse } from 'next/server';
import {
  actorDe,
  revertDraft,
  sendApproval,
  visibleModuleSlug,
  publicar,
} from '../../../../../src/server/cicloDeVida';
import { errorResponse, withoutSession } from '../../../../../src/server/respuestas';
import { sessionGet } from '../../../../../src/server/session';

export const runtime = 'nodejs';

/** Transiciones del ciclo de vida — seccion 4.1. */
const TRANSICIONES = ['enviar', 'publicar', 'devolver'] as const;
type Transition = (typeof TRANSICIONES)[number];

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const existente = await visibleModuleSlug(slug, actor);
  if (!existente) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const transition = body['transition'];
  if (typeof transition !== 'string' || !TRANSICIONES.includes(transition as Transition)) {
    return NextResponse.json(
      { error: `Transicion no admitida. Use una de: ${TRANSICIONES.join(', ')}.` },
      { status: 400 },
    );
  }

  const entrada = {
    actor,
    moduleId: existente.moduleId,
    ...(typeof body['motivo'] === 'string' ? { motivo: body['motivo'] } : {}),
  };

  try {
    const modulo =
      transition === 'enviar'
        ? await sendApproval(entrada)
        : transition === 'publicar'
          ? await publicar(entrada)
          : await revertDraft(entrada);

    return NextResponse.json({ modulo });
  } catch (error) {
    return errorResponse(error);
  }
}
