import { NextResponse } from 'next/server';
import type { Actor } from '@app/access-control';
import { PermissionError } from '@app/access-control';
import { AdminError, assertAdmin } from '../../../src/server/admin';
import { obtenerSesion } from '../../../src/server/sesion';

/** Envoltorio de los handlers del panel. */
export async function conAdmin<T>(
  fn: (actor: Actor) => Promise<T> | T,
): Promise<NextResponse> {
  let actor: Actor;
  try {
    actor = await assertAdmin(await obtenerSesion());
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.message, detail: error.detail }, { status: error.status });
    }
    throw error;
  }

  try {
    return NextResponse.json(await fn(actor));
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.message, detail: error.detail }, { status: error.status });
    }
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message, detail: error.denial }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
