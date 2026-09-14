import type { Bookmark } from '@app/module-model';
import { KEY_BOOKMARKS, escribir, readList } from './almacenCompartido';

/** Almacen de marcadores. */

const all = (): Promise<Bookmark[]> => readList<Bookmark>(KEY_BOOKMARKS);

export async function saveBookmark(marcador: Bookmark): Promise<Bookmark> {
  const actuales = await all();
  await escribir(KEY_BOOKMARKS, [...actuales.filter((m) => m.id !== marcador.id), marcador]);
  return marcador;
}

/** Marcadores visibles para una persona: los suyos y los compartidos con su equipo activo. */
export async function listarMarcadores(userId: string, teamId: string): Promise<Bookmark[]> {
  return (await all())
    .filter((m) => m.ownerUserId === userId || m.sharedWithTeamId === teamId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteBookmark(id: string, userId: string): Promise<boolean> {
  const actuales = await all();
  const marcador = actuales.find((m) => m.id === id);
  // Solo quien lo creo puede borrarlo.
  if (!marcador || marcador.ownerUserId !== userId) return false;

  await escribir(KEY_BOOKMARKS, actuales.filter((m) => m.id !== id));
  return true;
}
