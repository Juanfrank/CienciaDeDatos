import { NextResponse } from 'next/server';
import { urlDeConsulta } from '@app/nl-query';
import { resolverPregunta } from '../../../src/server/consulta';
import { sinSesion } from '../../../src/server/respuestas';
import { obtenerSesion } from '../../../src/server/sesion';

export const runtime = 'nodejs';

/** Longitud maxima de una pregunta. Mas alla de esto no es una pregunta, es un texto pegado. */
const MAXIMO = 300;

/** Resuelve una pregunta en lenguaje natural — seccion 4.9. */
export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const pregunta = typeof body['pregunta'] === 'string' ? body['pregunta'].trim() : '';
  const moduleSlug = typeof body['modulo'] === 'string' ? body['modulo'] : '';

  if (!pregunta) return NextResponse.json({ error: 'Falta la pregunta.' }, { status: 400 });
  if (pregunta.length > MAXIMO) {
    return NextResponse.json({ error: `La pregunta no puede pasar de ${MAXIMO} caracteres.` }, { status: 400 });
  }

  const resuelto = await resolverPregunta(pregunta, moduleSlug, sesion.userId, sesion.activeTeamId);

  // Modulo inexistente y modulo no concedido se responden igual, sin distinguirlos (4.11).
  if (!resuelto) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  const { consulta } = resuelto;
  return NextResponse.json({
    entendido: consulta.explicacion,
    resoluble: consulta.resoluble,
    noEntendido: consulta.noEntendido,
    filtros: consulta.filters,
    url: urlDeConsulta(moduleSlug, consulta),
  });
}
