import { queueExports } from '../../../../../src/server/exports';
import { withoutSession } from '../../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../../src/server/session';

export const runtime = 'nodejs';

/** Descarga del artefacto ya generado. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return withoutSession();

  const { id } = await params;
  const job = await queueExports.consultar(id);

  if (!job || job.request.requestedBy !== sesion.userId) {
    return new Response('Exportacion no encontrada.', { status: 404 });
  }

  if (job.status !== 'lista' || !job.artifact) {
    return new Response('La exportacion todavia no esta lista.', { status: 409 });
  }

  const contenido = Buffer.from(job.artifact.contentBase64, 'base64');
  return new Response(new Uint8Array(contenido), {
    headers: {
      'content-type': job.artifact.contentType,
      'content-length': String(job.artifact.bytes),
      'content-disposition': `attachment; filename="${job.artifact.filename}"`,
      // Un archivo con datos sujetos a ambito no se guarda en ningun intermediario.
      'cache-control': 'private, no-store',
    },
  });
}
