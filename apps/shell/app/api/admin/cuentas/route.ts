import { conAdmin } from '../guardia';
import { AdminError } from '../../../../src/server/admin';
import {
  CORREO_DISPONIBLE,
  canalDeRestablecimiento,
  cuentasLocales,
  desbloquearCuenta,
  restablecimientos,
} from '../../../../src/server/identidad';
import { registrarCambio } from '../../../../src/server/auditoria';

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
  const cuerpo = (await request.json()) as CuerpoDeCuenta;

  return conAdmin(async (actor) => {
    if (!cuerpo.email) throw new AdminError('Falta el correo de la cuenta.', 400);

    if (cuerpo.accion === 'desbloquear') {
      const desbloqueada = await desbloquearCuenta(cuerpo.email);
      if (!desbloqueada) throw new AdminError('No hay ninguna cuenta local con ese correo.', 404);

      await registrarCambio({
        actorId: actor.userId,
        entityType: 'role',
        entityId: cuerpo.email,
        action: 'update',
        after: { desbloqueada: true },
      });

      return { desbloqueada: cuerpo.email };
    }

    if (cuerpo.accion === 'restablecer') {
      const emitido = await restablecimientos.issue(cuerpo.email, actor.userId);
      if (!emitido) throw new AdminError('No hay ninguna cuenta local con ese correo.', 404);

      const entregado = await canalDeRestablecimiento.deliver({
        email: cuerpo.email,
        issued: emitido,
      });

      await registrarCambio({
        actorId: actor.userId,
        entityType: 'role',
        entityId: cuerpo.email,
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
