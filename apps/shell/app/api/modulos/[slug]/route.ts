import { NextResponse } from 'next/server';
import { cargarModulo } from '../../../../src/server/datos';
import { findModuleBySlug } from '../../../../src/server/modulos';
import { serializarObjeto } from '../../../../src/server/serializar';
import { sinSesion } from '../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../src/server/sesion';

export const runtime = 'nodejs';

/**
 * Datos de un modulo.
 *
 * Devuelve filas YA filtradas por el ambito de quien pide. Un cliente que llame a este endpoint
 * directamente obtiene exactamente lo mismo que la pagina: el filtrado no es una decision de la
 * interfaz, ocurre aqui.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const module = findModuleBySlug(slug);
  if (!module) {
    return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const requestedFilters: Record<string, string | string[]> = {};
  for (const clave of new Set(url.searchParams.keys())) {
    const valores = url.searchParams.getAll(clave);
    requestedFilters[clave] = valores.length > 1 ? valores : (valores[0] ?? '');
  }

  const cargado = await cargarModulo({
    module,
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters,
  });

  if (!cargado) {
    return NextResponse.json({ error: 'Pagina no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({
    modulo: { slug: module.slug, name: module.name, version: module.version },
    pagina: cargado.pageSlug,
    generatedAt: cargado.generatedAt,
    degradado: cargado.degraded,
    filtrosAplicados: cargado.appliedFilters,
    objetos: cargado.objetos.map(serializarObjeto),
  });
}
