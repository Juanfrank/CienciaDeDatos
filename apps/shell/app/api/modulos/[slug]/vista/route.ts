import { NextResponse } from 'next/server';
import { actorDe, moduloServiblePorSlug } from '../../../../../src/server/cicloDeVida';
import {
  PersonalizacionInvalidaError,
  descartarPersonalizacion,
  savePersonalization,
  readPersonalization,
} from '../../../../../src/server/personalization';
import { withoutSession } from '../../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../../src/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Vista personalizada de una persona sobre un modulo — seccion 4.6. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const modulo = await moduloServiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  const personalizacion = await readPersonalization(sesion.userId, modulo.moduleId);
  return NextResponse.json({
    personalizada: personalizacion !== undefined,
    ocultos: personalizacion?.hiddenItemIds ?? [],
    // Los objetos del modulo INSTITUCIONAL, para que la pantalla pueda ofrecer volver a mostrar
    // uno que se oculto: desde la vista personalizada ya no se ve, y sin esta lista no habria
    // forma de nombrarlo.
    objetos: modulo.pages.flatMap((p) =>
      p.items.map((i) => ({ id: i.id, titulo: i.instance.title })),
    ),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const modulo = await moduloServiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const ocultos = Array.isArray(body['ocultos'])
    ? (body['ocultos'] as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  try {
    const personalizacion = await savePersonalization({
      userId: sesion.userId,
      module: modulo,
      hiddenItemIds: ocultos,
      crudo: body,
    });
    return NextResponse.json({ personalizada: true, ocultos: personalizacion.hiddenItemIds });
  } catch (error) {
    if (error instanceof PersonalizacionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // `assertPersonalizationIsPresentationOnly` lanza un Error normal con su propio mensaje, que
    // explica el limite de 4.6. Se devuelve tal cual: es una explicacion, no un detalle interno.
    if (error instanceof Error && error.message.includes('4.6')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

/** Descarta la personalizacion y devuelve a la vista institucional oficial. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const modulo = await moduloServiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  await descartarPersonalizacion(sesion.userId, modulo.moduleId);
  return NextResponse.json({ personalizada: false, ocultos: [] });
}
