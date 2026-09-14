import { NextResponse } from 'next/server';
import {
  actorDe,
  historialDe,
  restaurarVersion,
  visibleModuleSlug,
} from '../../../../../src/server/cicloDeVida';
import { errorResponse, withoutSession } from '../../../../../src/server/respuestas';
import { sessionGet } from '../../../../../src/server/session';

export const runtime = 'nodejs';

/**
 * El historial de versiones publicadas de un modulo — seccion 4.5.
 *
 * Se listan las fotos SIN su definicion completa. Quien mira el historial quiere saber que hubo y
 * cuando; mandar el contenido entero de cada version hace que la respuesta crezca con los anos
 * para responder una pregunta que no lo necesita.
 *
 * El permiso lo comprueba `historialDe`, no esta ruta: quien puede verlo es quien administra.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const modulo = await visibleModuleSlug(slug, actor);
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let historial;
  try {
    historial = await historialDe(actor, modulo.moduleId);
  } catch (error) {
    return errorResponse(error);
  }

  return NextResponse.json({
    vigente: modulo.version,
    versiones: historial.map((v) => ({
      version: v.version,
      publishedAt: v.publishedAt,
      publishedBy: v.publishedBy,
      ...(v.restoredFrom === undefined ? {} : { restoredFrom: v.restoredFrom }),
      paginas: v.definition.pages.length,
      objetos: v.definition.pages.reduce((n, p) => n + p.items.length, 0),
    })),
  });
}

/** Vuelve a publicar el contenido de una version anterior. La comprobacion de rol la hace el caso de uso. */
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

  const version = body['version'];
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return NextResponse.json({ error: 'Se requiere el numero de version.' }, { status: 400 });
  }

  try {
    return NextResponse.json({
      modulo: await restaurarVersion({ actor, moduleId: modulo.moduleId, version }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
