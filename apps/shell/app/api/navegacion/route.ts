import { NextResponse } from 'next/server';
import { navigationOf } from '../../../src/server/cicloDeVida';
import { withoutSession } from '../../../src/server/respuestas';
import { sessionGet } from '../../../src/server/session';

export const runtime = 'nodejs';

/** Arbol de navegacion visible para el equipo activo (4.1.1, 4.10.6). */
export async function GET() {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  const view = await navigationOf(sesion);
  return NextResponse.json({
    equipoActivo: sesion.activeTeamId,
    arbol: view.tree,
    packageFrom: view.fromPackage,
    // Los nodos que un paquete no pudo mostrar se reportan al Administrador, no se ocultan.
    noMostrados: view.dangling,
  });
}
