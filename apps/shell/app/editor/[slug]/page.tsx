import { notFound } from 'next/navigation';
import { actorDe, bloqueosDePublicacion, moduloVisiblePorSlug } from '../../../src/server/cicloDeVida';
import { diagnosticarDefinicion, vistaPreviaDelBorrador } from '../../../src/server/data';
import { serializarObjeto } from '../../../src/server/serializar';
import { editorPalette } from '../../../src/server/editor';
import { exigirSesionDePagina } from '../../../src/server/session';
import { ModuleEditor } from '../../../src/components/editor/ModuleEditor';

export const dynamic = 'force-dynamic';

/** Editor de un modulo — seccion 4.2. */
export default async function ModuleEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const sesion = await exigirSesionDePagina();
  const { slug } = await params;

  const modulo = await moduloVisiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) notFound();

  // La vista previa se calcula en el servidor, como el resto: el primer pintado del lienzo ya
  // lleva los datos, sin un salto entre «esqueleto» y «modulo».
  const previa = await vistaPreviaDelBorrador({
    module: modulo,
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
  });

  // El editor monta sus dos columnas por su cuenta —taller y carril de objetos—, asi que la
  // pagina no lo envuelve en un `main` con padding: eso volveria a separar el carril del borde.
  return (
    <ModuleEditor
      initial={modulo}
      objetosIniciales={(previa?.objetos ?? []).map(serializarObjeto)}
      diagnosticos={await diagnosticarDefinicion(modulo)}
      locks={await bloqueosDePublicacion(modulo)}
      palette={await editorPalette()}
      editable={modulo.status === 'borrador' && modulo.ownerUserId === sesion.userId}
    />
  );
}
