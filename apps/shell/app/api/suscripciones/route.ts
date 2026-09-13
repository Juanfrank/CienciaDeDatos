import { NextResponse } from 'next/server';
import { FORMATS, type ExportFormat } from '@app/export';
import type { Cadence, Subscription } from '@app/alerts';
import { alertStore } from '../../../src/server/alertas';
import { actorDe, moduloServiblePorSlug } from '../../../src/server/cicloDeVida';
import { sinSesion } from '../../../src/server/respuestas';
import { obtenerSesion } from '../../../src/server/sesion';
import { normalizarFiltros } from '../../../src/server/filtros';

export const runtime = 'nodejs';

const CADENCIAS: Cadence[] = ['diaria', 'semanal', 'mensual'];

/** Suscripciones: entrega programada de una vista (4.9). */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();
  const todas = await alertStore.listSubscriptions();
  return NextResponse.json({
    suscripciones: todas.filter((s) => s.ownerUserId === sesion.userId),
  });
}

export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const nombre = typeof body['nombre'] === 'string' ? body['nombre'].trim() : '';
  const moduleSlug = typeof body['modulo'] === 'string' ? body['modulo'] : '';
  const formato = body['formato'] as ExportFormat;
  const cadencia = body['cadencia'] as Cadence;
  const hora = Number(body['hora'] ?? 8);

  if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  if (!FORMATS.includes(formato)) {
    return NextResponse.json(
      { error: `Formato no admitido. Use uno de: ${FORMATS.join(', ')}.` },
      { status: 400 },
    );
  }
  if (!CADENCIAS.includes(cadencia)) {
    return NextResponse.json(
      { error: `Cadencia no admitida. Use una de: ${CADENCIAS.join(', ')}.` },
      { status: 400 },
    );
  }
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) {
    return NextResponse.json({ error: 'La hora debe estar entre 0 y 23.' }, { status: 400 });
  }

  const module = await moduloServiblePorSlug(moduleSlug, await actorDe(sesion));
  if (!module) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  const suscripcion: Subscription = {
    id: crypto.randomUUID(),
    name: nombre,
    ownerUserId: sesion.userId,
    teamId: sesion.activeTeamId,
    moduleSlug: module.slug,
    ...(typeof body['pagina'] === 'string' ? { pageSlug: body['pagina'] } : {}),
    filters: normalizarFiltros(body['filtros']),
    format: formato,
    cadence: cadencia,
    hour: hora,
    ...(cadencia === 'semanal' ? { weekday: Number(body['diaSemana'] ?? 1) } : {}),
    ...(cadencia === 'mensual' ? { monthday: Number(body['diaMes'] ?? 1) } : {}),
    enabled: true,
  };

  await alertStore.saveSubscription(suscripcion);
  return NextResponse.json({ suscripcion }, { status: 201 });
}

export async function DELETE(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  const borrada = await alertStore.deleteSubscription(id, sesion.userId);
  if (!borrada) return NextResponse.json({ error: 'Suscripcion no encontrada.' }, { status: 404 });

  return NextResponse.json({ borrada: id });
}
