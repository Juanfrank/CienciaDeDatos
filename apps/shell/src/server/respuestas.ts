import { NextResponse } from 'next/server';
import { CicloDeVidaError } from './cicloDeVida';

/** Respuestas compartidas de las rutas de API. */
export const withoutSession = (): NextResponse =>
  NextResponse.json({ error: 'Se requiere iniciar sesion.' }, { status: 401 });

/** Traduce un error del ciclo de vida a HTTP. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof CicloDeVidaError) {
    return NextResponse.json(
      { error: error.message, detalle: error.detail },
      { status: error.status },
    );
  }
  throw error;
}
