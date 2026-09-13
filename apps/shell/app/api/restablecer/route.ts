import { NextResponse } from 'next/server';
import { PasswordResetError } from '@app/auth';
import { restablecimientos } from '../../../src/server/identidad';

export const runtime = 'nodejs';

/** Canje de un token de restablecimiento — seccion 4.7.2. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const resetId = typeof body['resetId'] === 'string' ? body['resetId'].trim() : '';
  const codigo = typeof body['codigo'] === 'string' ? body['codigo'].trim() : '';
  const clave = typeof body['clave'] === 'string' ? body['clave'] : '';

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
