import type { Bookmark } from '@app/module-model';

/**
 * Almacen de marcadores.
 *
 * En produccion vive en la base de identidad (4.10.7), junto al resto del gobierno. Aqui, en un
 * mapa de proceso colgado de globalThis para sobrevivir a la recarga en caliente del servidor
 * de desarrollo.
 *
 * Lo que se guarda es el marcador tal cual lo define el dominio: filtros, nunca datos ni el
 * ambito de quien lo creo.
 */
const almacen: Map<string, Bookmark> = ((globalThis as Record<string, unknown>)['__marcadores'] ??=
  new Map()) as Map<string, Bookmark>;

export function guardarMarcador(marcador: Bookmark): Bookmark {
  almacen.set(marcador.id, marcador);
  return marcador;
}

/**
 * Marcadores visibles para una persona: los suyos y los compartidos con su equipo activo.
 *
 * Ver un marcador ajeno no concede nada: al abrirlo, sus filtros se intersecan con el ambito de
 * quien lo abre, asi que dos personas con ambitos distintos ven datos distintos desde el mismo
 * marcador.
 */
export function listarMarcadores(userId: string, teamId: string): Bookmark[] {
  return [...almacen.values()]
    .filter((m) => m.ownerUserId === userId || m.sharedWithTeamId === teamId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function borrarMarcador(id: string, userId: string): boolean {
  const marcador = almacen.get(id);
  // Solo quien lo creo puede borrarlo.
  if (!marcador || marcador.ownerUserId !== userId) return false;
  almacen.delete(id);
  return true;
}
