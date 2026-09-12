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

    /*
     * Con el guardado vuelven los diagnosticos Y LOS DATOS.
     *
     * Los diagnosticos, porque 4.2 pide validar el esquema en cada carga del editor y lo roto
     * tiene que marcarse en el momento, no en la siguiente. Los datos, porque el editor dibuja el
     * modulo de verdad: mapear una medida y ver aparecer la cifra es la diferencia entre editar
     * una configuracion y editar lo que se va a publicar.
     *
     * Van en la MISMA respuesta que el guardado y no en una peticion aparte: son el resultado de
     * este cambio, y pedirlos despues abre una ventana en la que lo dibujado no corresponde a lo
     * guardado.
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

/**
 * Los objetos del borrador, ya leidos y recortados por el ambito de quien edita.
 *
 * Devuelve una lista vacia si el modulo no tiene paginas: una vista previa vacia es un estado
 * legitimo —un borrador recien creado no tiene nada— y no un error que deba tumbar el guardado.
 */
async function previsualizar(modulo: ModuleDefinition, userId: string, teamId: string) {
  const previa = await vistaPreviaDelBorrador({ module: modulo, userId, teamId });
  return (previa?.objetos ?? []).map(serializarObjeto);
}
