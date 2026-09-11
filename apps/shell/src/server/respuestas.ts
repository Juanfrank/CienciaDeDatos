import { NextResponse } from 'next/server';

/**
 * Respuestas compartidas de las rutas de API.
 *
 * `sinSesion` existe para que la comprobacion sea una linea en cada handler y el mensaje sea
 * siempre el mismo. Se responde 401 y no se redirige: quien llama a /api/* es codigo, y un 302
 * hacia una pagina HTML se le presenta como un exito con un cuerpo que no sabe leer.
 */
export const sinSesion = (): NextResponse =>
  NextResponse.json({ error: 'Se requiere iniciar sesion.' }, { status: 401 });
