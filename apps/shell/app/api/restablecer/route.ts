import { NextResponse } from 'next/server';
import { PasswordResetError } from '@app/auth';
import { restablecimientos } from '../../../src/server/identidad';

export const runtime = 'nodejs';

/**
 * Canje de un token de restablecimiento — seccion 4.7.2.
 *
 * SIN sesion, por definicion: quien llega aqui no puede entrar. La autorizacion es el token, que
 * es de un solo uso, corto de vida y se guardo hasheado.
 *
 * No hay ningun GET: no existe forma de preguntar si un resetId es valido sin intentar canjearlo.
 * Un endpoint de comprobacion seria un oraculo para tantear tokens sin gastar intentos.
 */
export async function POST(request: Request) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const resetId = typeof cuerpo['resetId'] === 'string' ? cuerpo['resetId'].trim() : '';
  const codigo = typeof cuerpo['codigo'] === 'string' ? cuerpo['codigo'].trim() : '';
  const clave = typeof cuerpo['clave'] === 'string' ? cuerpo['clave'] : '';

  if (!resetId || !codigo || !clave) {
    return NextResponse.json(
      { error: 'Se requieren el identificador, el codigo y la contrasena nueva.' },
      { status: 400 },
    );
  }

  try {
    await restablecimientos.redeem({
      resetId,
      token: codigo,
      newPassword: clave,
      ...(request.headers.get('x-forwarded-for')
        ? { sourceIp: request.headers.get('x-forwarded-for') as string }
        : {}),
    });
    return NextResponse.json({ restablecida: true });
  } catch (error) {
    if (error instanceof PasswordResetError) {
      // 422 cuando el problema es la contraseña propuesta —el token servia— y 400 cuando el
      // problema es el token. La diferencia le dice a quien lo usa si tiene que pedir otro
      // codigo o solo elegir mejor la contraseña.
      const estado =
        error.reason === 'politica-incumplida' || error.reason === 'reutiliza-contrasena'
          ? 422
          : 400;
      return NextResponse.json(
        { error: error.message, motivo: error.reason, detalle: error.detail },
        { status: estado },
      );
    }
    throw error;
  }
}
