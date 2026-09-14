import { NextResponse } from 'next/server';
import { withoutRead } from '@app/alerts';
import { notificaciones } from '../../../src/server/alerts';
import { withoutSession } from '../../../src/server/respuestas';
import { sessionGet } from '../../../src/server/session';

export const runtime = 'nodejs';

/** Bandeja de notificaciones. */
export async function GET() {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  const lista = await notificaciones.list(sesion.userId);
  return NextResponse.json({ notificaciones: lista, withoutRead: withoutRead(lista) });
}

export async function POST(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  let body: { ids?: unknown };
  try {
    body = (await request.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string')
    : [];

  await notificaciones.markRead(sesion.userId, ids);

  const lista = await notificaciones.list(sesion.userId);
  return NextResponse.json({ withoutRead: withoutRead(lista) });
}
