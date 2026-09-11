import { conAdmin } from '../guardia';
import { dimensionesDisponibles } from '../../../../src/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dimensiones seleccionables en el editor de ambitos.
 *
 * Salen del SchemaDescriptor que el job dejo en el CACHE, no de `getSchema()`: el principio 2
 * vale tambien dentro del panel de administracion, que es justo donde seria tentador saltarselo.
 */
export async function GET() {
  return conAdmin(async () => ({ dimensiones: await dimensionesDisponibles() }));
}
