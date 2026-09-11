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

/**
 * Cuentas locales — seccion 4.7.2.
 *
 * "Documenta y haz visible en el panel de administracion cuantas cuentas locales existen y por
 * que": son la excepcion, no la via por defecto, y una lista que crece sin que nadie la mire es
 * como dejan de serlo.
 *
 * Aqui viven las dos vias de recuperacion que 4.7.2 exige cuando dice "no bloqueo indefinido sin
 * via de recuperacion": desbloquear, y restablecer la contraseña.
 */
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
         *
         * No es lo que pide 4.7.2 —eso es el correo verificado— y por eso la respuesta lleva el
         * canal y el `entregado: false` bien visibles, y queda registrado quien lo tramito. El
         * dia que haya correo, `deliver` devuelve true y este campo deja de venir, sin tocar
         * nada mas. Ver docs/hoja-de-ruta.md.
         */
        ...(entregado ? {} : { codigo: emitido.token }),
      };
    }

    throw new AdminError('Accion desconocida.', 400);
  });
}
