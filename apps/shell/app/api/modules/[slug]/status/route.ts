import { NextResponse } from 'next/server';
import type { ModuleDefinition } from '@app/module-model';
import {
  actorDe,
  type InputTransition,
  restablecer,
  retirar,
  revertDraft,
  sendApproval,
  visibleModuleSlug,
  publicar,
} from '../../../../../src/server/cicloDeVida';
import { errorResponse, withoutSession } from '../../../../../src/server/respuestas';
import { sessionGet } from '../../../../../src/server/session';

export const runtime = 'nodejs';

/**
 * Transiciones del ciclo de vida — seccion 4.1.
 *
 * Cada nombre es UNA funcion del ciclo de vida, y la tabla es la unica que las relaciona: sin
 * ella el encadenado de ternarios que habia aqui obligaba a leer el orden de las ramas para
 * saber que hacia cada nombre, y anadir una quinta habria sido anadir un nivel mas.
 */
const TRANSICIONES: Record<string, (entrada: InputTransition) => Promise<ModuleDefinition>> = {
  enviar: sendApproval,
  publicar,
  devolver: revertDraft,
  retirar,
  restablecer,
};

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const { slug } = await params;
  const actor = await actorDe(sesion);
  const existente = await visibleModuleSlug(slug, actor);
  if (!existente) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const transition = body['transition'];
  // Por `Object.hasOwn` y no por `TRANSICIONES[nombre]`: con la segunda, pedir `constructor` o
  // `toString` habria encontrado una funcion del prototipo y la habria llamado con la entrada.
  const aplicar =
    typeof transition === 'string' && Object.hasOwn(TRANSICIONES, transition)
      ? TRANSICIONES[transition]
      : undefined;
  if (!aplicar) {
    return NextResponse.json(
      { error: `Transicion no admitida. Use una de: ${Object.keys(TRANSICIONES).join(', ')}.` },
      { status: 400 },
    );
  }

  const entrada = {
    actor,
    moduleId: existente.moduleId,
    ...(typeof body['motivo'] === 'string' ? { motivo: body['motivo'] } : {}),
  };

  try {
    return NextResponse.json({ modulo: await aplicar(entrada) });
  } catch (error) {
    return errorResponse(error);
  }
}
