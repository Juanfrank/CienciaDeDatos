import { NextResponse } from 'next/server';
import type { ModulePage } from '@app/module-model';
import {
  actorDe,
  bloqueosDePublicacion,
  borrarModulo,
  guardarBorrador,
  moduloVisiblePorSlug,
} from '../../../../../src/server/cicloDeVida';
import { diagnosticarDefinicion } from '../../../../../src/server/datos';
import { respuestaDeError, sinSesion } from '../../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../../src/server/sesion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Edicion de la DEFINICION de un modulo — seccion 4.2.
 *
 * Va en su propia ruta y no en `/api/modulos/[slug]`, que sirve DATOS ya filtrados por el ambito
 * de quien mira. Son dos cosas distintas: alli se pregunta "que veo yo de este modulo", aqui
 * "como esta construido". Mezclarlas en un mismo handler haria que un GET devolviera una cosa u
 * otra segun un parametro, que es la forma habitual de que una de las dos se quede sin guardian.
 */

/** La definicion con sus diagnosticos, que es lo que el editor necesita para dibujarla. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const modulo = await moduloVisiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  return NextResponse.json({
    modulo,
    diagnosticos: await diagnosticarDefinicion(modulo),
    bloqueos: await bloqueosDePublicacion(modulo),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const existente = await moduloVisiblePorSlug(slug, actor);
  if (!existente) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  try {
    const modulo = await guardarBorrador({
      actor,
      moduleId: existente.moduleId,
      cambios: {
        ...(typeof cuerpo['nombre'] === 'string' ? { name: cuerpo['nombre'] } : {}),
        ...(Array.isArray(cuerpo['paginas'])
          ? { pages: cuerpo['paginas'] as ModulePage[] }
          : {}),
      },
    });

    // Se devuelven los diagnosticos con el guardado: el editor tiene que marcar lo roto en el
    // momento, no en la siguiente carga (4.2 pide validar el esquema en CADA carga del editor).
    return NextResponse.json({
      modulo,
      diagnosticos: await diagnosticarDefinicion(modulo),
      bloqueos: await bloqueosDePublicacion(modulo),
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const existente = await moduloVisiblePorSlug(slug, actor);
  if (!existente) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  try {
    await borrarModulo({ actor, moduleId: existente.moduleId });
    return NextResponse.json({ borrado: existente.moduleId });
  } catch (error) {
    return respuestaDeError(error);
  }
}
