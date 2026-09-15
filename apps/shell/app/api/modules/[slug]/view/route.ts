import { NextResponse } from 'next/server';
import type { GridPosition } from '@app/module-model';
import { actorDe, slugServableModule } from '../../../../../src/server/cicloDeVida';
import {
  PersonalizationInvalidError,
  personalizationDiscard,
  savePersonalization,
  readPersonalization,
} from '../../../../../src/server/personalization';
import { withoutSession } from '../../../../../src/server/respuestas';
import { sessionGet } from '../../../../../src/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las posiciones del cuerpo, o `undefined` si no vienen.
 *
 * Se leen campo a campo y se exige que los cuatro sean enteros finitos. Lo que llega es JSON de
 * fuera: un `NaN` o un `1e308` colado en `y` produciria una disposicion que ninguna comprobacion
 * posterior sabe describir, y quedaria guardado contra esa persona.
 */
function positionsRead(crudo: unknown): Record<string, GridPosition> | undefined {
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return undefined;

  const salida: Record<string, GridPosition> = {};
  for (const [itemId, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (typeof valor !== 'object' || valor === null) continue;
    const p = valor as Record<string, unknown>;
    const numeros = ['x', 'y', 'w', 'h'].map((k) => p[k]);
    if (!numeros.every((n) => typeof n === 'number' && Number.isSafeInteger(n))) continue;
    const [x, y, w, h] = numeros as number[];
    salida[itemId] = { x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1 };
  }
  return salida;
}

/** Vista personalizada de una persona sobre un modulo — seccion 4.6. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const modulo = await slugServableModule(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  const personalizacion = await readPersonalization(sesion.userId, modulo.moduleId);
  return NextResponse.json({
    personalizada: personalizacion !== undefined,
    ocultos: personalizacion?.hiddenItemIds ?? [],
    posiciones: personalizacion?.positionOverrides ?? {},
    // Los objetos del modulo INSTITUCIONAL, para que la pantalla pueda ofrecer volver a mostrar
    // uno que se oculto: desde la vista personalizada ya no se ve, y sin esta lista no habria
    // forma de nombrarlo.
    objetos: modulo.pages.flatMap((p) =>
      p.items.map((i) => ({ id: i.id, titulo: i.instance.title })),
    ),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const modulo = await slugServableModule(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  /*
   * Lo que no viene NO se toca.
   *
   * Ocultar y colocar son dos gestos distintos, en dos pantallas distintas, y ninguna de las dos
   * conoce lo de la otra: la que coloca no puede enumerar los objetos ocultos, porque no los ve.
   * Mandando siempre el registro entero, cada gesto habria borrado el anterior.
   */
  const ocultos = Array.isArray(body['ocultos'])
    ? (body['ocultos'] as unknown[]).filter((v): v is string => typeof v === 'string')
    : undefined;
  const posiciones = positionsRead(body['posiciones']);

  try {
    const personalizacion = await savePersonalization({
      userId: sesion.userId,
      module: modulo,
      ...(ocultos ? { hiddenItemIds: ocultos } : {}),
      ...(posiciones ? { positionOverrides: posiciones } : {}),
      crudo: body,
    });
    return NextResponse.json({
      personalizada: true,
      ocultos: personalizacion.hiddenItemIds,
      posiciones: personalizacion.positionOverrides,
    });
  } catch (error) {
    if (error instanceof PersonalizationInvalidError) {
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
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const modulo = await slugServableModule(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  await personalizationDiscard(sesion.userId, modulo.moduleId);
  return NextResponse.json({ personalizada: false, ocultos: [] });
}
