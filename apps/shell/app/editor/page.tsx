import {
  actorDe,
  bloqueosDePublicacion,
  visibleModules,
} from '../../src/server/cicloDeVida';
import { exigirSesionDePagina } from '../../src/server/session';
import { EditorHeader } from '../../src/components/editor/EditorHeader';
import { ModuleList } from '../../src/components/editor/ModuleList';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editor de modulos' };

/** Lista de modulos del editor — secciones 4.1 y 4.2. */
export default async function EditorPage() {
  const sesion = await exigirSesionDePagina();
  const actor = await actorDe(sesion);
  const visibles = await visibleModules(actor);

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
      locks: m.status === 'publicado' ? [] : await bloqueosDePublicacion(m),
    })),
  );

  return (
    <>
      <EditorHeader />
      <main className="editor__body">
        <ModuleList modules={dataRows} role={actor.role} user={actor.userId} />
      </main>
    </>
  );
}
