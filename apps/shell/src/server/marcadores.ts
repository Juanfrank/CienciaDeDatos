import type { Bookmark } from '@app/module-model';
import { CLAVE_MARCADORES, escribir, leerLista } from './almacenCompartido';

/** Almacen de marcadores. */

const todos = (): Promise<Bookmark[]> => leerLista<Bookmark>(CLAVE_MARCADORES);

export async function guardarMarcador(marcador: Bookmark): Promise<Bookmark> {
  const actuales = await todos();
  await escribir(CLAVE_MARCADORES, [...actuales.filter((m) => m.id !== marcador.id), marcador]);
  return marcador;
}

/** Marcadores visibles para una persona: los suyos y los compartidos con su equipo activo. */
export async function listarMarcadores(userId: string, teamId: string): Promise<Bookmark[]> {
  return (await todos())
    .filter((m) => m.ownerUserId === userId || m.sharedWithTeamId === teamId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function borrarMarcador(id: string, userId: string): Promise<boolean> {
  const actuales = await todos();
  const marcador = actuales.find((m) => m.id === id);
  // Solo quien lo creo puede borrarlo.
  if (!marcador || marcador.ownerUserId !== userId) return false;

  await escribir(CLAVE_MARCADORES, actuales.filter((m) => m.id !== id));
  return true;
}
