import { SeesWhoWhere } from '../../../src/components/admin/WhoSeesWhat';
import { getGeneralTree, listTeams, listUsers } from '../../../src/server/context';
import type { NavNode } from '@app/access-control';

export const dynamic = 'force-dynamic';

function treeModules(nodos: NavNode[], acumulado: { moduleId: string; name: string }[] = []) {
  for (const node of nodos) {
    if (node.type === 'module') acumulado.push({ moduleId: node.moduleRef.moduleId, name: node.moduleRef.name });
    else treeModules(node.children, acumulado);
  }
  return acumulado;
}

export default async function PageWhoSeesWhere() {
  return (
    <section>
      <h2>Quien ve que</h2>
      <p className="muted-text">
        Resuelve el ambito efectivo de una persona sobre un modulo y muestra que capa lo causo.
        Sirve para depurar una configuracion ANTES de publicarla, no para descubrir el issue
        despues.
      </p>
      <SeesWhoWhere
        usuarios={(await listUsers()).map((u) => u.userId)}
        equipos={(await listTeams()).map((t) => ({ id: t.id, name: t.name }))}
        modules={treeModules(await getGeneralTree())}
      />
    </section>
  );
}
