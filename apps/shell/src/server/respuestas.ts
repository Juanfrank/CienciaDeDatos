import { NextResponse } from 'next/server';
import { CicloDeVidaError } from './cicloDeVida';

/**
 * Respuestas compartidas de las rutas de API.
 *
 * `sinSesion` existe para que la comprobacion sea una linea en cada handler y el mensaje sea
 * siempre el mismo. Se responde 401 y no se redirige: quien llama a /api/* es codigo, y un 302
 * hacia una pagina HTML se le presenta como un exito con un cuerpo que no sabe leer.
 */
export const sinSesion = (): NextResponse =>
  NextResponse.json({ error: 'Se requiere iniciar sesion.' }, { status: 401 });

/**
 * Traduce un error del ciclo de vida a HTTP.
 *
 * El servicio ya decidio el codigo —403 sin permiso, 409 si la transicion no existe, 422 si hay
 * bloqueos— y aqui solo se transporta. Lo que no sea un error del dominio se vuelve a lanzar:
 * convertir cualquier excepcion en un 400 esconde los fallos de programacion detras de un
 * mensaje que parece una validacion.
 */
export function respuestaDeError(error: unknown): NextResponse {
  if (error instanceof CicloDeVidaError) {
    return NextResponse.json(
      { error: error.message, detalle: error.detail },
      { status: error.status },
    );
  }
  throw error;
}
