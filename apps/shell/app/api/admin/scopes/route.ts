import type { AccessScope } from '@app/access-control';
import { withAdmin } from '../guardia';
import { AdminError, saveScope, validateDimensions } from '../../../../src/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScopeBody {
  destino: { tipo: 'carpeta'; nodeId: string } | { tipo: 'equipo'; teamId: string };
  scope: AccessScope;
  justificacion?: string;
}

/** Guarda un ambito de acceso (4.10.3). */
export async function POST(request: Request) {
  const body = (await request.json()) as ScopeBody;

  return withAdmin(async (actor) => {
    const desconocidas = await validateDimensions(body.scope);
    if (desconocidas.length > 0) {
      throw new AdminError(
        `Dimensiones que no existen en el esquema activo: ${desconocidas.join(', ')}. ` +
          `El editor solo admite dimensiones del esquema real (4.10.8).`,
        422,
        { desconocidas },
      );
    }

    return {
      scope: await saveScope({
        actor,
        destino: body.destino,
        scope: body.scope,
        ...(body.justificacion ? { justificacion: body.justificacion } : {}),
      }),
    };
  });
}
