import { withAdmin } from '../guardia';
import { dimensionesDisponibles } from '../../../../src/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Dimensiones seleccionables en el editor de ambitos. */
export async function GET() {
  return withAdmin(async () => ({ dimensiones: await dimensionesDisponibles() }));
}
