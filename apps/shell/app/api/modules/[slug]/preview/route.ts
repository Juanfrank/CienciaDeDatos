import { NextResponse } from 'next/server';
import type { ModuleDefinition, ModulePage } from '@app/module-model';
import { actorDe, publicationLocks, visibleModuleSlug } from '../../../../../src/server/cicloDeVida';
import { definitionDiagnose, draftPreviousView } from '../../../../../src/server/data';
import { objectSerialize } from '../../../../../src/server/serialize';
import { withoutSession } from '../../../../../src/server/respuestas';
import { sessionGet } from '../../../../../src/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dibuja un borrador SIN guardarlo — seccion 4.2.
 *
 * Existe porque el editor dejo de guardar en cada gesto. Antes, cada objeto anadido o cada campo
 * mapeado escribia en el almacen y el lienzo se dibujaba con lo que devolvia esa escritura; el
 * dibujo era un efecto secundario de guardar. Separar las dos cosas —guardar cuando alguien lo
 * pide, dibujar siempre— exige poder pedir lo segundo sin lo primero.
 *
 * No escribe nada, y por eso es un POST y no un PUT: lleva cuerpo, pero no crea ni reemplaza
 * ningun recurso. El permiso es el de VER el modulo, no el de editarlo: no cambia nada.
 */
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
  if (!Array.isArray(body['paginas'])) {
    return NextResponse.json({ error: 'Se requieren las paginas.' }, { status: 400 });
  }

  // El borrador se arma en memoria sobre la definicion guardada: asi el ambito, el autor y el
  // estado siguen siendo los de verdad, y lo unico que viene del cliente son las paginas.
  const borrador: ModuleDefinition = {
    ...existente,
    pages: body['paginas'] as ModulePage[],
  };

  // Que pagina se esta editando. Sin esto se devolvia siempre la primera, asi que el editor no
  // podia dibujar ninguna otra —y por tanto tampoco editarlas—. `draftPreviousView` ya sabia
  // recibirla; lo que faltaba era que alguien se la dijera.
  const pagina = typeof body['pagina'] === 'string' ? body['pagina'] : undefined;

  return NextResponse.json({
    diagnosticos: await definitionDiagnose(borrador),
    locks: await publicationLocks(borrador),
    objetos: await previsualizar(borrador, sesion.userId, sesion.activeTeamId, pagina),
  });
}

/** La misma proyeccion que usa el camino de edicion, para que el dibujo no difiera. */
async function previsualizar(
  modulo: ModuleDefinition,
  userId: string,
  teamId: string,
  pageSlug?: string,
) {
  const previa = await draftPreviousView({
    module: modulo,
    userId,
    teamId,
    ...(pageSlug ? { pageSlug } : {}),
  });
  return (previa?.objetos ?? []).map(objectSerialize);
}
