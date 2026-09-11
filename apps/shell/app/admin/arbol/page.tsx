import { EditorDeArbol } from '../../../src/components/admin/EditorDeArbol';
import { getManagedTree } from '../../../src/server/contexto';

export const dynamic = 'force-dynamic';

export default async function PaginaArbol() {
  return (
    <section>
      <h2>Organizacion general</h2>
      <p className="texto-atenuado">
        Es la estructura canonica y la unica fuente de verdad sobre donde vive cada modulo y que
        ambito hereda. Mover algo aqui cambia el acceso de lo que se mueve, asi que el editor
        avisa antes de confirmarlo.
      </p>
      <EditorDeArbol inicial={await getManagedTree()} />
    </section>
  );
}
