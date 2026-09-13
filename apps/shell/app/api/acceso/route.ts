import { NextResponse } from 'next/server';
import { AuthenticationError } from '@app/auth';
import {
  AZURE_AD_DISPONIBLE,
  asegurarCredenciales,
  proveedorLocal,
  sesiones,
} from '../../../src/server/identity';
import { teamsOf } from '../../../src/server/context';
import { COOKIE_SESION, closeSession, obtenerSesion } from '../../../src/server/session';

export const runtime = 'nodejs';

/** Inicio de sesion — seccion 4.7. */
const MENSAJES: Record<string, string> = {
  'credenciales-invalidas': 'Correo o contrasena incorrectos.',
  'cuenta-bloqueada': 'La cuenta esta bloqueada temporalmente por intentos fallidos.',
  'mfa-requerido': 'Introduzca el codigo de su aplicacion de autenticacion.',
  'mfa-invalido': 'El codigo de verificacion no es valido.',
  'sin-identidad-institucional': 'Correo o contrasena incorrectos.',
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const proveedor = typeof body['proveedor'] === 'string' ? body['proveedor'] : 'local';

  if (proveedor === 'azure-ad') {
    // Declarado y no disponible, como los conectores de datos pendientes: se dice, no se simula
    // un inicio de sesion que pareceria funcionar.
    return NextResponse.json(
      {
        error: AZURE_AD_DISPONIBLE
          ? 'El inicio de sesion con Azure AD todavia no esta habilitado en este entorno.'
          : 'Azure AD no esta configurado en este entorno. Use credenciales locales.',
      },
      { status: 501 },
    );
  }

  const correo = typeof body['correo'] === 'string' ? body['correo'].trim() : '';
  const clave = typeof body['clave'] === 'string' ? body['clave'] : '';
  const codigo = typeof body['codigo'] === 'string' ? body['codigo'].trim() : undefined;

  if (!correo || !clave) {
    return NextResponse.json({ error: 'Faltan el correo o la contrasena.' }, { status: 400 });
  }

  await asegurarCredenciales();

  try {
    const principal = await proveedorLocal().authenticate({
      email: correo,
      password: clave,
      ...(codigo ? { totpCode: codigo } : {}),
      // La IP se registra en la auditoria de login; en App Service llega por esta cabecera.
      ...(request.headers.get('x-forwarded-for')
        ? { sourceIp: request.headers.get('x-forwarded-for') as string }
        : {}),
    });

    // El equipo activo inicial es el PRIMERO al que pertenece, nunca la union de todos: 4.10.4
    // resuelve el ambito con el equipo activo, y sin uno no hay ambito que resolver.
    const equipos = await teamsOf(principal.userId);
    const primero = equipos[0];
    if (!primero) {
      return NextResponse.json(
        { error: 'Su cuenta no pertenece a ningun equipo. Contacte con un Administrador.' },
        { status: 403 },
      );
    }

    const sesion = await sesiones.issue(principal, primero.id);

    const respuesta = NextResponse.json({
      userId: principal.userId,
      equipoActivo: sesion.activeTeamId,
      proveedor: principal.authProvider,
    });
    respuesta.cookies.set(COOKIE_SESION, sesion.sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      // Sin HTTPS en desarrollo la cookie con `secure` no se enviaria y no habria sesion.
      secure: process.env['NODE_ENV'] === 'production',
    });
    return respuesta;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      const estado = error.reason === 'mfa-requerido' ? 428 : 401;
      return NextResponse.json(
        { error: MENSAJES[error.reason] ?? 'No se pudo iniciar sesion.', motivo: error.reason },
        { status: estado },
      );
    }
    throw error;
  }
}

/** Cierre de sesion: se revoca la fila y se retira la cookie. */
export async function DELETE() {
  const sesion = await obtenerSesion();
  if (sesion) await closeSession(sesion.sessionId);

  const respuesta = NextResponse.json({ cerrada: true });
  respuesta.cookies.delete(COOKIE_SESION);
  return respuesta;
}
