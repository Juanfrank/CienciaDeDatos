import type { ModulePackage } from '@app/access-control';
import { conAdmin } from '../guardia';
import { AdminError, guardarPaquete } from '../../../../src/server/admin';
import { gobierno } from '../../../../src/server/gobierno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return conAdmin(async () => ({ paquetes: await gobierno.listPackages() }));
}

/**
 * Guarda un paquete visual (4.1.3) y lo valida automaticamente (4.10.6).
 *
 * No rechaza el guardado —un paquete puede crearse antes de asignarse a nadie— pero devuelve
 * `noMostrables`: los nodos que referencia y que la audiencia destino no tiene concedidos. El
 * documento pide que eso se señale EXPLICITAMENTE al Administrador, no que se oculte sin aviso.
 *
 * Sea cual sea el resultado, la seguridad no depende de esta validacion: aunque el paquete
 * incluya un modulo no concedido, `buildNavigationView` no lo muestra. La validacion existe para
 * que el Administrador lo sepa, no para que el sistema sea seguro.
 */
export async function POST(request: Request) {
  const cuerpo = (await request.json()) as { paquete?: ModulePackage; borrar?: string };

  return conAdmin(async (actor) => {
    if (cuerpo.borrar) {
      const borrado = await gobierno.deletePackage(cuerpo.borrar);
      if (!borrado) throw new AdminError(`El paquete '${cuerpo.borrar}' no existe.`, 404);
      return { borrado: cuerpo.borrar };
    }
    if (!cuerpo.paquete) throw new AdminError('Falta el paquete.', 400);
    return await guardarPaquete(actor, cuerpo.paquete);
  });
}
