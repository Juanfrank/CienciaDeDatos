import { NextResponse } from 'next/server';
import { queueExports } from '../../../../src/server/exports';
import { withoutSession } from '../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../src/server/session';

export const runtime = 'nodejs';

/** Estado de una exportacion — el "estado de progreso consultable" que pide 5.3. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return withoutSession();

  const { id } = await params;
  const job = await queueExports.consultar(id);

  // Un trabajo ajeno se responde como inexistente, no como prohibido: decir "403" confirmaria
  // que ese identificador existe y de quien es.
  if (!job || job.request.requestedBy !== sesion.userId) {
    return NextResponse.json({ error: 'Exportacion no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    estado: job.status,
    formato: job.request.format,
    creada: job.createdAt,
    terminada: job.finishedAt,
    error: job.error,
    ...(job.artifact
      ? {
          archivo: {
            nombre: job.artifact.filename,
            bytes: job.artifact.bytes,
            descargarEn: `/api/exportaciones/${job.id}/descarga`,
          },
        }
      : {}),
  });
}
