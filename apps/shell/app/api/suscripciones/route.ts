import { NextResponse } from 'next/server';
import { FORMATOS, type ExportFormat } from '@app/export';
import type { Cadence, Subscription } from '@app/alerts';
import { alertStore } from '../../../src/server/alertas';
import { actorDe, moduloServiblePorSlug } from '../../../src/server/cicloDeVida';
import { sinSesion } from '../../../src/server/respuestas';
import { obtenerSesion } from '../../../src/server/sesion';
import { normalizarFiltros } from '../../../src/server/filtros';

export const runtime = 'nodejs';

const CADENCIAS: Cadence[] = ['diaria', 'semanal', 'mensual'];

/**
 * Suscripciones: entrega programada de una vista (4.9).
 *
 * Una suscripcion es una exportacion programada, asi que reutiliza la cola de 5.3 y su misma
 * puerta de ambito. Igual que en las alertas, el usuario y el equipo salen de la sesion y nunca
 * del cuerpo: son los que deciden que datos lleva el archivo entregado.
 */
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

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const nombre = typeof cuerpo['nombre'] === 'string' ? cuerpo['nombre'].trim() : '';
  const moduleSlug = typeof cuerpo['modulo'] === 'string' ? cuerpo['modulo'] : '';
  const formato = cuerpo['formato'] as ExportFormat;
  const cadencia = cuerpo['cadencia'] as Cadence;
  const hora = Number(cuerpo['hora'] ?? 8);

  if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  if (!FORMATOS.includes(formato)) {
    return NextResponse.json(
      { error: `Formato no admitido. Use uno de: ${FORMATOS.join(', ')}.` },
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
    ...(typeof cuerpo['pagina'] === 'string' ? { pageSlug: cuerpo['pagina'] } : {}),
    filters: normalizarFiltros(cuerpo['filtros']),
    format: formato,
    cadence: cadencia,
    hour: hora,
    ...(cadencia === 'semanal' ? { weekday: Number(cuerpo['diaSemana'] ?? 1) } : {}),
    ...(cadencia === 'mensual' ? { monthday: Number(cuerpo['diaMes'] ?? 1) } : {}),
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
