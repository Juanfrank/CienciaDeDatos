import { NextResponse } from 'next/server';
import { FORMATS, type ExportFormat } from '@app/export';
import type { Cadence, Subscription } from '@app/alerts';
import { alertStore } from '../../../src/server/alerts';
import { actorDe, slugServableModule } from '../../../src/server/cicloDeVida';
import { withoutSession } from '../../../src/server/respuestas';
import { sessionGet } from '../../../src/server/session';
import { filtersNormalize } from '../../../src/server/filters';

export const runtime = 'nodejs';

const CADENCIAS: Cadence[] = ['diaria', 'semanal', 'mensual'];

/** Suscripciones: entrega programada de una vista (4.9). */
export async function GET() {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  const todas = await alertStore.listSubscriptions();
  return NextResponse.json({
    suscripciones: todas.filter((s) => s.ownerUserId === sesion.userId),
  });
}

export async function POST(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

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

  // El dia se valida igual que la hora, que era lo que faltaba. Sin esto, un `diaSemana` que no
  // fuera un numero producia una fecha invalida en el calendario, y una fecha invalida compara
  // falso con todo: la suscripcion se entregaba la primera vez que el trabajador la mirara, a
  // cualquier hora. Un 99 la mandaba tres meses por delante y no se entregaba nunca.
  const diaSemana = Number(body['diaSemana'] ?? 1);
  const diaMes = Number(body['diaMes'] ?? 1);
  if (cadencia === 'semanal' && (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6)) {
    return NextResponse.json(
      { error: 'El dia de la semana debe estar entre 0 (domingo) y 6 (sabado).' },
      { status: 400 },
    );
  }
  if (cadencia === 'mensual' && (!Number.isInteger(diaMes) || diaMes < 1 || diaMes > 31)) {
    return NextResponse.json({ error: 'El dia del mes debe estar entre 1 y 31.' }, { status: 400 });
  }

  const module = await slugServableModule(moduleSlug, await actorDe(sesion));
  if (!module) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  const suscripcion: Subscription = {
    id: crypto.randomUUID(),
    name: nombre,
    ownerUserId: sesion.userId,
    teamId: sesion.activeTeamId,
    moduleSlug: module.slug,
    ...(typeof body['pagina'] === 'string' ? { pageSlug: body['pagina'] } : {}),
    filters: filtersNormalize(body['filtros']),
    format: formato,
    cadence: cadencia,
    hour: hora,
    ...(cadencia === 'semanal' ? { weekday: diaSemana } : {}),
    ...(cadencia === 'mensual' ? { monthday: diaMes } : {}),
    enabled: true,
  };

  await alertStore.saveSubscription(suscripcion);
  return NextResponse.json({ suscripcion }, { status: 201 });
}

export async function DELETE(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  const borrada = await alertStore.deleteSubscription(id, sesion.userId);
  if (!borrada) return NextResponse.json({ error: 'Suscripcion no encontrada.' }, { status: 404 });

  return NextResponse.json({ borrada: id });
}
