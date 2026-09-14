import { NextResponse } from 'next/server';
import { FORMATS, type ExportFormat } from '@app/export';
import { exportEnqueue } from '../../../src/server/exports';
import { filtersNormalize } from '../../../src/server/filters';
import { withoutSession } from '../../../src/server/respuestas';
import { sessionGet } from '../../../src/server/session';

export const runtime = 'nodejs';

/** Encola una exportacion (4.9, encolada por 5.3). */
export async function POST(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const formato = body['formato'];
  if (typeof formato !== 'string' || !FORMATS.includes(formato as ExportFormat)) {
    return NextResponse.json(
      { error: `Formato no admitido. Use uno de: ${FORMATS.join(', ')}.` },
      { status: 400 },
    );
  }

  const moduleSlug = body['modulo'];
  if (typeof moduleSlug !== 'string' || moduleSlug === '') {
    return NextResponse.json({ error: 'Falta el modulo.' }, { status: 400 });
  }

  const pageSlug = typeof body['pagina'] === 'string' ? body['pagina'] : undefined;
  const filtros = filtersNormalize(body['filtros']);

  const job = await exportEnqueue({
    moduleSlug,
    ...(pageSlug ? { pageSlug } : {}),
    format: formato as ExportFormat,
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    appliedFilters: filtros,
  });

  if (!job) {
    return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });
  }

  return NextResponse.json(
    { id: job.id, estado: job.status, consultarEn: `/api/exportaciones/${job.id}` },
    { status: 202 },
  );
}
