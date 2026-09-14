import { NextResponse } from 'next/server';
import { moduleLoad } from '../../../../src/server/data';
import { actorDe, slugServableModule } from '../../../../src/server/cicloDeVida';
import { readPersonalization } from '../../../../src/server/personalization';
import { objectSerialize } from '../../../../src/server/serialize';
import { withoutSession } from '../../../../src/server/respuestas';
import { sessionGet } from '../../../../src/server/session';

export const runtime = 'nodejs';

/** Datos de un modulo. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  // Por slug pero filtrando por estado: un borrador ajeno no se sirve aunque se pida a mano.
  const module = await slugServableModule(slug, await actorDe(sesion));
  if (!module) {
    return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const requestedFilters: Record<string, string | string[]> = {};
  for (const clave of new Set(url.searchParams.keys())) {
    const valores = url.searchParams.getAll(clave);
    requestedFilters[clave] = valores.length > 1 ? valores : (valores[0] ?? '');
  }

  const loaded = await moduleLoad({
    module,
    personalization: await readPersonalization(sesion.userId, module.moduleId),
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters,
  });

  if (!loaded) {
    return NextResponse.json({ error: 'Pagina no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({
    modulo: { slug: module.slug, name: module.name, version: module.version },
    pagina: loaded.pageSlug,
    generatedAt: loaded.generatedAt,
    degradado: loaded.degraded,
    filtrosAplicados: loaded.appliedFilters,
    objetos: loaded.objetos.map(objectSerialize),
  });
}
