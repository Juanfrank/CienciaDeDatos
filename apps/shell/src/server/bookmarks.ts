import type { Bookmark } from '@app/module-model';
import { KEY_BOOKMARKS, mutar, readList } from './almacenCompartido';

/** Almacen de marcadores. */

const all = (): Promise<Bookmark[]> => readList<Bookmark>(KEY_BOOKMARKS);

export async function saveBookmark(marcador: Bookmark): Promise<Bookmark> {
  // Bajo turno: dos personas guardando un marcador a la vez leian la misma lista y la segunda
  // en escribir borraba el de la primera.
  await mutar<Bookmark[]>(KEY_BOOKMARKS, (actuales) => [
    ...(actuales ?? []).filter((m) => m.id !== marcador.id),
    marcador,
  ]);
  return marcador;
}

/** Marcadores visibles para una persona: los suyos y los compartidos con su equipo activo. */
export async function bookmarksList(userId: string, teamId: string): Promise<Bookmark[]> {
  return (await all())
    .filter((m) => m.ownerUserId === userId || m.sharedWithTeamId === teamId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteBookmark(id: string, userId: string): Promise<boolean> {
  // La comprobacion de propiedad va DENTRO del turno: fuera, entre comprobar y borrar cabe otra
  // escritura, y se borraria sobre una lista que ya no es la que se comprobo.
  let borrado = false;
  await mutar<Bookmark[]>(KEY_BOOKMARKS, (actuales) => {
    const lista = actuales ?? [];
    const marcador = lista.find((m) => m.id === id);
    // Solo quien lo creo puede borrarlo.
    if (!marcador || marcador.ownerUserId !== userId) return lista;
    borrado = true;
    return lista.filter((m) => m.id !== id);
  });
  return borrado;
}
