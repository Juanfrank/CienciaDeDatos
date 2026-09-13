import { conAdmin } from '../guardia';
import { AdminError } from '../../../../src/server/admin';
import {
  CORREO_DISPONIBLE,
  canalDeRestablecimiento,
  cuentasLocales,
  desbloquearCuenta,
  restablecimientos,
} from '../../../../src/server/identity';
import { registrarCambio } from '../../../../src/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cuentas locales — seccion 4.7.2. */
export async function GET() {
  return conAdmin(async () => ({
    cuentas: await cuentasLocales(),
    canal: canalDeRestablecimiento.name,
    correoDisponible: CORREO_DISPONIBLE,
  }));
}

interface CuerpoDeCuenta {
  accion: 'desbloquear' | 'restablecer';
  email?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as CuerpoDeCuenta;

  return conAdmin(async (actor) => {
    if (!body.email) throw new AdminError('Falta el correo de la cuenta.', 400);

    if (body.accion === 'desbloquear') {
      const desbloqueada = await desbloquearCuenta(body.email);
      if (!desbloqueada) throw new AdminError('No hay ninguna cuenta local con ese correo.', 404);

      await registrarCambio({
        actorId: actor.userId,
        entityType: 'role',
        entityId: body.email,
        action: 'update',
        after: { desbloqueada: true },
      });

      return { desbloqueada: body.email };
    }

    if (body.accion === 'restablecer') {
      const emitido = await restablecimientos.issue(body.email, actor.userId);
      if (!emitido) throw new AdminError('No hay ninguna cuenta local con ese correo.', 404);

      const entregado = await canalDeRestablecimiento.deliver({
        email: body.email,
        issued: emitido,
      });

      await registrarCambio({
        actorId: actor.userId,
        entityType: 'role',
        entityId: body.email,
        action: 'update',
        after: { restablecimiento: emitido.resetId, canal: canalDeRestablecimiento.name, entregado },
      });

      return {
        resetId: emitido.resetId,
        expiraEn: emitido.expiresAt,
        canal: canalDeRestablecimiento.name,
        entregado,
        /*
         * El token viaja en la RESPUESTA a quien lo tramito, y solo cuando el canal automatico
         * no pudo entregarlo. Es el flujo mediado: el Administrador ya verifico la identidad de
         * la persona por una via de la que responde, y le dicta el codigo.
         */
        ...(entregado ? {} : { codigo: emitido.token }),
      };
    }

    throw new AdminError('Accion desconocida.', 400);
  });
}
