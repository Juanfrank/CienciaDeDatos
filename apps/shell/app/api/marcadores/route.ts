import { NextResponse } from 'next/server';
import { captureBookmark } from '@app/module-model';
import { borrarMarcador, guardarMarcador, listarMarcadores } from '../../../src/server/marcadores';
import { obtenerSesion } from '../../../src/server/sesion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Marcadores visibles: los propios y los compartidos con el equipo activo (4.4). */
export async function GET() {
  const sesion = await obtenerSesion();
  return NextResponse.json({ marcadores: await listarMarcadores(sesion.userId, sesion.activeTeamId) });
}

/**
 * Guarda el estado de filtros actual como marcador.
 *
 * Recibe la query string, no las filas: un marcador es una URL con nombre. Guardar el resultado
 * seria lo que convertiria un marcador compartido en una fuga de datos del creador.
 */
export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  const cuerpo = (await request.json()) as {
    name?: string;
    moduleSlug?: string;
    pageSlug?: string;
    query?: string;
    compartir?: boolean;
  };

  if (!cuerpo.name?.trim() || !cuerpo.moduleSlug) {
    return NextResponse.json({ error: 'Se requieren name y moduleSlug.' }, { status: 400 });
  }

  const marcador = await guardarMarcador(
    captureBookmark({
      id: crypto.randomUUID(),
      name: cuerpo.name.trim(),
      ownerUserId: sesion.userId,
      moduleSlug: cuerpo.moduleSlug,
      ...(cuerpo.pageSlug ? { pageSlug: cuerpo.pageSlug } : {}),
      searchParams: new URLSearchParams(cuerpo.query ?? ''),
      createdAt: new Date().toISOString(),
      ...(cuerpo.compartir ? { sharedWithTeamId: sesion.activeTeamId } : {}),
    }),
  );

  return NextResponse.json({ marcador }, { status: 201 });
}

export async function DELETE(request: Request) {
  const sesion = await obtenerSesion();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Se requiere id.' }, { status: 400 });

  const borrado = await borrarMarcador(id, sesion.userId);
  return borrado
    ? NextResponse.json({ borrado: id })
    : NextResponse.json({ error: 'No existe o no es suyo.' }, { status: 404 });
}
