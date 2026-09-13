import {
  actorDe,
  bloqueosDePublicacion,
  modulosVisibles,
} from '../../src/server/cicloDeVida';
import { exigirSesionDePagina } from '../../src/server/sesion';
import { CabeceraDeEditor } from '../../src/components/editor/CabeceraDeEditor';
import { ListaDeModulos } from '../../src/components/editor/ListaDeModulos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editor de modulos' };

/** Lista de modulos del editor — secciones 4.1 y 4.2. */
export default async function PaginaEditor() {
  const sesion = await exigirSesionDePagina();
  const actor = await actorDe(sesion);
  const visibles = await modulosVisibles(actor);

  const dataRows = await Promise.all(
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

  return (
    <>
      <CabeceraDeEditor />
      <main className="editor__cuerpo">
        <ListaDeModulos modulos={dataRows} role={actor.role} user={actor.userId} />
      </main>
    </>
  );
}
