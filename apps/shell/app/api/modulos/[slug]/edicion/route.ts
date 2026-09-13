import { NextResponse } from 'next/server';
import type { ModuleDefinition, ModulePage } from '@app/module-model';
import {
  actorDe,
  bloqueosDePublicacion,
  borrarModulo,
  guardarBorrador,
  moduloVisiblePorSlug,
} from '../../../../../src/server/cicloDeVida';
import { diagnosticarDefinicion, vistaPreviaDelBorrador } from '../../../../../src/server/datos';
import { serializarObjeto } from '../../../../../src/server/serializar';
import { respuestaDeError, sinSesion } from '../../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../../src/server/sesion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Edicion de la DEFINICION de un modulo — seccion 4.2. */

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
    objetos: await previsualizar(modulo, sesion.userId, sesion.activeTeamId),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const existente = await moduloVisiblePorSlug(slug, actor);
  if (!existente) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  try {
    const modulo = await guardarBorrador({
      actor,
      moduleId: existente.moduleId,
      cambios: {
        ...(typeof body['nombre'] === 'string' ? { name: body['nombre'] } : {}),
        ...(Array.isArray(body['paginas'])
          ? { pages: body['paginas'] as ModulePage[] }
          : {}),
      },
    });

    /*
     * Con el guardado vuelven los diagnosticos Y LOS DATOS.
     */
    return NextResponse.json({
      modulo,
      diagnosticos: await diagnosticarDefinicion(modulo),
      bloqueos: await bloqueosDePublicacion(modulo),
      objetos: await previsualizar(modulo, sesion.userId, sesion.activeTeamId),
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

/** Los objetos del borrador, ya leidos y recortados por el ambito de quien edita. */
async function previsualizar(modulo: ModuleDefinition, userId: string, teamId: string) {
  const previa = await vistaPreviaDelBorrador({ module: modulo, userId, teamId });
  return (previa?.objetos ?? []).map(serializarObjeto);
}
