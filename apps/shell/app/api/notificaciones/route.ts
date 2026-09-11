import { NextResponse } from 'next/server';
import { sinLeer } from '@app/alerts';
import { notificaciones } from '../../../src/server/alertas';
import { sinSesion } from '../../../src/server/respuestas';
import { obtenerSesion } from '../../../src/server/sesion';

export const runtime = 'nodejs';

/**
 * Bandeja de notificaciones.
 *
 * Se sirve siempre la de QUIEN PIDE, tomada de la sesion: no hay parametro de usuario que
 * manipular. Una bandeja ajena contiene cifras del ambito de otra persona, asi que no es solo
 * un asunto de privacidad de la bandeja — es el mismo aislamiento del principio 5.
 */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();
  const lista = await notificaciones.list(sesion.userId);
  return NextResponse.json({ notificaciones: lista, sinLeer: sinLeer(lista) });
}

export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  let cuerpo: { ids?: unknown };
  try {
    cuerpo = (await request.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const ids = Array.isArray(cuerpo.ids)
    ? cuerpo.ids.filter((x): x is string => typeof x === 'string')
    : [];

  await notificaciones.markRead(sesion.userId, ids);

  const lista = await notificaciones.list(sesion.userId);
  return NextResponse.json({ sinLeer: sinLeer(lista) });
}
