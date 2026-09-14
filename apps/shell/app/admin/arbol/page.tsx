import { TreeEditor } from '../../../src/components/admin/TreeEditor';
import { getManagedTree } from '../../../src/server/context';

export const dynamic = 'force-dynamic';

export default async function TreePage() {
  return (
    <section>
      <h2>Organizacion general</h2>
      <p className="muted-text">
        Es la estructura canonica y la unica origen de verdad sobre donde vive cada modulo y que
        ambito hereda. Mover algo aqui cambia el acceso de lo que se mueve, asi que el editor
        avisa antes de confirmarlo.
      </p>
      <TreeEditor initial={await getManagedTree()} />
    </section>
  );
}
