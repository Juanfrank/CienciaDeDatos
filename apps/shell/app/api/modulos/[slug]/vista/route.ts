import { NextResponse } from 'next/server';
import { actorDe, moduloServiblePorSlug } from '../../../../../src/server/cicloDeVida';
import {
  PersonalizacionInvalidaError,
  descartarPersonalizacion,
  guardarPersonalizacion,
  leerPersonalizacion,
} from '../../../../../src/server/personalizacion';
import { sinSesion } from '../../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../../src/server/sesion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vista personalizada de una persona sobre un modulo — seccion 4.6.
 *
 * Es la vista de QUIEN PIDE, siempre: no hay parametro de usuario y no lo habra. La sesion dice
 * de quien es la vista, igual que en marcadores y avisos; aceptarlo del cuerpo convertiria esto
 * en una forma de leer —y de reescribir— la vista de otra persona.
 *
 * La personalizacion se limita a la capa de presentacion (4.6). El tipo no admite un cambio de
 * medida y, ademas, el cuerpo se comprueba: lo que llega por la red no lo protege un tipo.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const modulo = await moduloServiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  const personalizacion = await leerPersonalizacion(sesion.userId, modulo.moduleId);
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
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const modulo = await moduloServiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const ocultos = Array.isArray(cuerpo['ocultos'])
    ? (cuerpo['ocultos'] as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  try {
    const personalizacion = await guardarPersonalizacion({
      userId: sesion.userId,
      module: modulo,
      hiddenItemIds: ocultos,
      crudo: cuerpo,
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
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const modulo = await moduloServiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  await descartarPersonalizacion(sesion.userId, modulo.moduleId);
  return NextResponse.json({ personalizada: false, ocultos: [] });
}
