import { notFound } from 'next/navigation';
import { actorDe, bloqueosDePublicacion, moduloVisiblePorSlug } from '../../../src/server/cicloDeVida';
import { diagnosticarDefinicion } from '../../../src/server/datos';
import { paletaDelEditor } from '../../../src/server/editor';
import { exigirSesionDePagina } from '../../../src/server/sesion';
import { EditorDeModulo } from '../../../src/components/editor/EditorDeModulo';

export const dynamic = 'force-dynamic';

/**
 * Editor de un modulo — seccion 4.2.
 *
 * "En cada carga del editor se valida el esquema" — de ahi que los diagnosticos se calculen aqui,
 * en el servidor, y viajen con la definicion. Si un campo mapeado ya no existe, el objeto se
 * dibuja MARCADO ROTO y el modulo sigue editandose: no se falla en silencio ni se deja la
 * pantalla en blanco.
 */
export default async function PaginaEditorDeModulo({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const sesion = await exigirSesionDePagina();
  const { slug } = await params;

  const modulo = await moduloVisiblePorSlug(slug, await actorDe(sesion));
  if (!modulo) notFound();

  return (
    <EditorDeModulo
      inicial={modulo}
      diagnosticos={await diagnosticarDefinicion(modulo)}
      bloqueos={await bloqueosDePublicacion(modulo)}
      paleta={await paletaDelEditor()}
      editable={modulo.status === 'borrador' && modulo.ownerUserId === sesion.userId}
    />
  );
}
