import { NextResponse } from 'next/server';
import { FORMATOS, type ExportFormat } from '@app/export';
import { encolarExportacion } from '../../../src/server/exportaciones';
import { normalizarFiltros } from '../../../src/server/filtros';
import { sinSesion } from '../../../src/server/respuestas';
import { obtenerSesion } from '../../../src/server/sesion';

export const runtime = 'nodejs';

/** Encola una exportacion (4.9, encolada por 5.3). */
export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const formato = cuerpo['formato'];
  if (typeof formato !== 'string' || !FORMATOS.includes(formato as ExportFormat)) {
    return NextResponse.json(
      { error: `Formato no admitido. Use uno de: ${FORMATOS.join(', ')}.` },
      { status: 400 },
    );
  }

  const moduleSlug = cuerpo['modulo'];
  if (typeof moduleSlug !== 'string' || moduleSlug === '') {
    return NextResponse.json({ error: 'Falta el modulo.' }, { status: 400 });
  }

  const pageSlug = typeof cuerpo['pagina'] === 'string' ? cuerpo['pagina'] : undefined;
  const filtros = normalizarFiltros(cuerpo['filtros']);

  const job = await encolarExportacion({
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
