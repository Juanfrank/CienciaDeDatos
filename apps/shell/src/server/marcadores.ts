import type { Bookmark } from '@app/module-model';
import { CLAVE_MARCADORES, escribir, leerLista } from './almacenCompartido';

/**
 * Almacen de marcadores.
 *
 * Vive en el almacen COMPARTIDO, no en un mapa de proceso. Un marcador es "estado de
 * personalizacion", y la seccion 9 exige que no se pierda al escalar a mas de una instancia:
 * guardarlo en la instancia A y no verlo desde la B es exactamente esa perdida.
 *
 * En produccion vive en la base de identidad (4.10.7), junto al resto del gobierno.
 *
 * Lo que se guarda es el marcador tal cual lo define el dominio: filtros, nunca datos ni el
 * ambito de quien lo creo.
 */

const todos = (): Promise<Bookmark[]> => leerLista<Bookmark>(CLAVE_MARCADORES);

export async function guardarMarcador(marcador: Bookmark): Promise<Bookmark> {
  const actuales = await todos();
  await escribir(CLAVE_MARCADORES, [...actuales.filter((m) => m.id !== marcador.id), marcador]);
  return marcador;
}

/**
 * Marcadores visibles para una persona: los suyos y los compartidos con su equipo activo.
 *
 * Ver un marcador ajeno no concede nada: al abrirlo, sus filtros se intersecan con el ambito de
 * quien lo abre, asi que dos personas con ambitos distintos ven datos distintos desde el mismo
 * marcador.
 */
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
