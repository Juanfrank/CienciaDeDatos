import {
  actorDe,
  bloqueosDePublicacion,
  modulosVisibles,
} from '../../src/server/cicloDeVida';
import { exigirSesionDePagina } from '../../src/server/sesion';
import { ListaDeModulos } from '../../src/components/editor/ListaDeModulos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editor de modulos' };

/**
 * Lista de modulos del editor — secciones 4.1 y 4.2.
 *
 * Muestra estado, autor y BLOQUEOS. Los bloqueos van en la lista y no escondidos tras el boton
 * de enviar: saber por que algo no se puede proponer antes de intentarlo es la diferencia entre
 * una pantalla que informa y una que solo dice que no.
 */
export default async function PaginaEditor() {
  const sesion = await exigirSesionDePagina();
  const actor = await actorDe(sesion);
  const visibles = await modulosVisibles(actor);

  const filas = await Promise.all(
    visibles.map(async (m) => ({
      moduleId: m.moduleId,
      slug: m.slug,
      name: m.name,
      status: m.status,
      version: m.version,
      autor: m.ownerUserId ?? null,
      propio: m.ownerUserId === actor.userId,
      objetos: m.pages.reduce((total, p) => total + p.items.length, 0),
      bloqueos: m.status === 'publicado' ? [] : await bloqueosDePublicacion(m),
    })),
  );

  return <ListaDeModulos modulos={filas} rol={actor.role} usuario={actor.userId} />;
}
