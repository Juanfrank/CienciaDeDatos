import { NextResponse } from 'next/server';
import { navegacionDe } from '../../../src/server/cicloDeVida';
import { sinSesion } from '../../../src/server/respuestas';
import { obtenerSesion } from '../../../src/server/sesion';

export const runtime = 'nodejs';

/** Arbol de navegacion visible para el equipo activo (4.1.1, 4.10.6). */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();
  const vista = await navegacionDe(sesion);
  return NextResponse.json({
    equipoActivo: sesion.activeTeamId,
    arbol: vista.tree,
    desdePaquete: vista.fromPackage,
    // Los nodos que un paquete no pudo mostrar se reportan al Administrador, no se ocultan.
    noMostrados: vista.dangling,
  });
}
