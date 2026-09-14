import { NextResponse } from 'next/server';
import { captureBookmark } from '@app/module-model';
import { deleteBookmark, saveBookmark, bookmarksList } from '../../../src/server/bookmarks';
import { withoutSession } from '../../../src/server/respuestas';
import { sessionGet } from '../../../src/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Marcadores visibles: los propios y los compartidos con el equipo activo (4.4). */
export async function GET() {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  return NextResponse.json({ bookmarks: await bookmarksList(sesion.userId, sesion.activeTeamId) });
}

/** Guarda el estado de filtros actual como marcador. */
export async function POST(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  const body = (await request.json()) as {
    name?: string;
    moduleSlug?: string;
    pageSlug?: string;
    query?: string;
    compartir?: boolean;
  };

  if (!body.name?.trim() || !body.moduleSlug) {
    return NextResponse.json({ error: 'Se requieren name y moduleSlug.' }, { status: 400 });
  }

  const marcador = await saveBookmark(
    captureBookmark({
      id: crypto.randomUUID(),
      name: body.name.trim(),
      ownerUserId: sesion.userId,
      moduleSlug: body.moduleSlug,
      ...(body.pageSlug ? { pageSlug: body.pageSlug } : {}),
      searchParams: new URLSearchParams(body.query ?? ''),
      createdAt: new Date().toISOString(),
      ...(body.compartir ? { sharedWithTeamId: sesion.activeTeamId } : {}),
    }),
  );

  return NextResponse.json({ marcador }, { status: 201 });
}

export async function DELETE(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Se requiere id.' }, { status: 400 });

  const borrado = await deleteBookmark(id, sesion.userId);
  return borrado
    ? NextResponse.json({ borrado: id })
    : NextResponse.json({ error: 'No existe o no es suyo.' }, { status: 404 });
}
