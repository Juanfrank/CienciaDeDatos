import { withAdmin } from '../guardia';
import { availableDimensions } from '../../../../src/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Dimensiones seleccionables en el editor de ambitos. */
export async function GET() {
  return withAdmin(async () => ({ dimensiones: await availableDimensions() }));
}
