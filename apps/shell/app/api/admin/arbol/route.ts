import { conAdmin } from '../guardia';
import {
  ejecutarOperacionDeArbol,
  previsualizarMovimiento,
} from '../../../../src/server/admin';
import { getManagedTree } from '../../../../src/server/contexto';
import type { TreeOperation } from '@app/access-control';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Organizacion general vigente, con su papelera. */
export async function GET() {
  return conAdmin(async () => await getManagedTree());
}

/** Aplica una operacion sobre el arbol (4.1, 4.1.2). */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const cuerpo = (await request.json()) as TreeOperation;

  if (url.searchParams.get('previsualizar') === '1') {
    if (cuerpo.type !== 'mover') {
      return conAdmin(async () => ({ cambiaElAmbito: false, moduleIds: [] }));
    }
    return conAdmin(async () => await previsualizarMovimiento(cuerpo.nodeId, cuerpo.newParentId));
  }

  return conAdmin(async (actor) => ({ arbol: await ejecutarOperacionDeArbol(actor, cuerpo) }));
}
