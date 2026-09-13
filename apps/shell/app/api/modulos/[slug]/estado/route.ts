import { NextResponse } from 'next/server';
import {
  actorDe,
  devolverABorrador,
  enviarAAprobacion,
  moduloVisiblePorSlug,
  publicar,
} from '../../../../../src/server/cicloDeVida';
import { respuestaDeError, sinSesion } from '../../../../../src/server/respuestas';
import { obtenerSesion } from '../../../../../src/server/sesion';

export const runtime = 'nodejs';

/** Transiciones del ciclo de vida — seccion 4.1. */
const TRANSICIONES = ['enviar', 'publicar', 'devolver'] as const;
type Transicion = (typeof TRANSICIONES)[number];

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const existente = await moduloVisiblePorSlug(slug, actor);
  if (!existente) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const transicion = cuerpo['transicion'];
  if (typeof transicion !== 'string' || !TRANSICIONES.includes(transicion as Transicion)) {
    return NextResponse.json(
      { error: `Transicion no admitida. Use una de: ${TRANSICIONES.join(', ')}.` },
      { status: 400 },
    );
  }

  const entrada = {
    actor,
    moduleId: existente.moduleId,
    ...(typeof cuerpo['motivo'] === 'string' ? { motivo: cuerpo['motivo'] } : {}),
  };

  try {
    const modulo =
      transicion === 'enviar'
        ? await enviarAAprobacion(entrada)
        : transicion === 'publicar'
          ? await publicar(entrada)
          : await devolverABorrador(entrada);

    return NextResponse.json({ modulo });
  } catch (error) {
    return respuestaDeError(error);
  }
}
