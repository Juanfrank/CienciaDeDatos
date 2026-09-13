import type { ModulePackage } from '@app/access-control';
import { conAdmin } from '../guardia';
import { AdminError, guardarPaquete } from '../../../../src/server/admin';
import { gobierno } from '../../../../src/server/gobierno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return conAdmin(async () => ({ paquetes: await gobierno.listPackages() }));
}

/** Guarda un paquete visual (4.1.3) y lo valida automaticamente (4.10.6). */
export async function POST(request: Request) {
  const body = (await request.json()) as { paquete?: ModulePackage; borrar?: string };

  return conAdmin(async (actor) => {
    if (body.borrar) {
      const borrado = await gobierno.deletePackage(body.borrar);
      if (!borrado) throw new AdminError(`El paquete '${body.borrar}' no existe.`, 404);
      return { borrado: body.borrar };
    }
    if (!body.paquete) throw new AdminError('Falta el paquete.', 400);
    return await guardarPaquete(actor, body.paquete);
  });
}
