import type { AccessScope } from '@app/access-control';
import { conAdmin } from '../guardia';
import { AdminError, guardarAmbito, validarDimensiones } from '../../../../src/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CuerpoAmbito {
  destino: { tipo: 'carpeta'; nodeId: string } | { tipo: 'equipo'; teamId: string };
  scope: AccessScope;
  justificacion?: string;
}

/** Guarda un ambito de acceso (4.10.3). */
export async function POST(request: Request) {
  const cuerpo = (await request.json()) as CuerpoAmbito;

  return conAdmin(async (actor) => {
    const desconocidas = await validarDimensiones(cuerpo.scope);
    if (desconocidas.length > 0) {
      throw new AdminError(
        `Dimensiones que no existen en el esquema activo: ${desconocidas.join(', ')}. ` +
          `El editor solo admite dimensiones del esquema real (4.10.8).`,
        422,
        { desconocidas },
      );
    }

    return {
      scope: await guardarAmbito({
        actor,
        destino: cuerpo.destino,
        scope: cuerpo.scope,
        ...(cuerpo.justificacion ? { justificacion: cuerpo.justificacion } : {}),
      }),
    };
  });
}
