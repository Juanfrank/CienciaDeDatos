import { colaExportaciones } from '../../../../../src/server/exportaciones';
import { sinSesion } from '../../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../../src/server/sesion';

export const runtime = 'nodejs';

/**
 * Descarga del artefacto ya generado.
 *
 * La comprobacion de propiedad se repite aqui, no se hereda de la ruta de estado: son dos
 * solicitudes distintas y una URL de descarga se comparte por chat con facilidad. Es el mismo
 * criterio de la seccion 9 —comprobar en el backend, no ocultar en la interfaz— aplicado al
 * archivo, que es donde estan los datos.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const { id } = await params;
  const job = await colaExportaciones.consultar(id);

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
