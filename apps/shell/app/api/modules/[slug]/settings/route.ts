import { NextResponse } from 'next/server';
import {
  actorDe,
  saveSettings,
  visibleModuleSlug,
  type ModuleSettings,
} from '../../../../../src/server/cicloDeVida';
import { errorResponse, withoutSession } from '../../../../../src/server/respuestas';
import { sessionGet } from '../../../../../src/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Configuracion de un modulo — secciones 4.1 y 4.11.
 *
 * Aparte de `/edit`, que edita el CONTENIDO de un borrador. Aqui se cambia lo que el modulo es
 * —nombre, URL, descripcion, que ofrece, con que filtros abre— y eso tambien se hace sobre un
 * modulo publicado, que `/edit` rechaza por diseno.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const modulo = await visibleModuleSlug(slug, actor);
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  const body = (await request.json()) as { settings?: Partial<ModuleSettings> };
  const entrada = body.settings;
  if (!entrada) return NextResponse.json({ error: 'Falta la configuracion.' }, { status: 400 });

  try {
    const actualizado = await saveSettings({
      actor,
      moduleId: modulo.moduleId,
      settings: {
        name: entrada.name ?? modulo.name,
        slug: entrada.slug ?? modulo.slug,
        description: entrada.description ?? modulo.description ?? '',
        options: entrada.options ?? modulo.options ?? {},
        defaultFilters: entrada.defaultFilters ?? modulo.defaultFilters ?? [],
      },
    });
    return NextResponse.json({ modulo: actualizado });
  } catch (error) {
    return errorResponse(error);
  }
}
