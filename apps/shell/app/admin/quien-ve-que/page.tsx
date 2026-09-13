import { QuienVeQue } from '../../../src/components/admin/QuienVeQue';
import { getGeneralTree, listTeams, listUsers } from '../../../src/server/contexto';
import type { NavNode } from '@app/access-control';

export const dynamic = 'force-dynamic';

function modulosDelArbol(nodos: NavNode[], acumulado: { moduleId: string; name: string }[] = []) {
  for (const node of nodos) {
    if (node.type === 'module') acumulado.push({ moduleId: node.moduleRef.moduleId, name: node.moduleRef.name });
    else modulosDelArbol(node.children, acumulado);
  }
  return acumulado;
}

export default async function PaginaQuienVeQue() {
  return (
    <section>
      <h2>Quien ve que</h2>
      <p className="texto-atenuado">
        Resuelve el ambito efectivo de una persona sobre un modulo y muestra que capa lo causo.
        Sirve para depurar una settings ANTES de publicarla, no para descubrir el issue
        after.
      </p>
      <QuienVeQue
        usuarios={(await listUsers()).map((u) => u.userId)}
        equipos={(await listTeams()).map((t) => ({ id: t.id, name: t.name }))}
        modulos={modulosDelArbol(await getGeneralTree())}
      />
    </section>
  );
}
