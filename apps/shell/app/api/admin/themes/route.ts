import { withAdmin } from '../guardia';
import { activateTheme, deleteTheme, saveTheme } from '../../../../src/server/theme';
import type { ThemeDefinition } from '@app/design-tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Cuerpo {
  accion: 'guardar' | 'activar' | 'borrar';
  tema?: ThemeDefinition;
  themeId?: string;
}

/** Crear, editar, activar y borrar temas — seccion 4.3. */
export async function POST(request: Request) {
  const body = (await request.json()) as Cuerpo;

  return withAdmin(async (actor) => {
    if (body.accion === 'guardar') {
      if (!body.tema) throw new Error('Falta el tema.');
      return { tema: await saveTheme(actor, body.tema) };
    }
    if (body.accion === 'activar') {
      await activateTheme(actor, body.themeId ?? '');
      return { activo: body.themeId };
    }
    await deleteTheme(actor, body.themeId ?? '');
    return { borrado: body.themeId };
  });
}
