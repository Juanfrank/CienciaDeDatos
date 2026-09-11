import { QuienVeQue } from '../../../src/components/admin/QuienVeQue';
import { getGeneralTree, listTeams, listUsers } from '../../../src/server/contexto';
import type { NavNode } from '@app/access-control';

export const dynamic = 'force-dynamic';

function modulosDelArbol(nodos: NavNode[], acumulado: { moduleId: string; name: string }[] = []) {
  for (const nodo of nodos) {
    if (nodo.type === 'module') acumulado.push({ moduleId: nodo.moduleRef.moduleId, name: nodo.moduleRef.name });
    else modulosDelArbol(nodo.children, acumulado);
  }
  return acumulado;
}

export default async function PaginaQuienVeQue() {
  return (
    <section>
      <h2>Quien ve que</h2>
      <p className="texto-atenuado">
        Resuelve el ambito efectivo de una persona sobre un modulo y muestra que capa lo causo.
        Sirve para depurar una configuracion ANTES de publicarla, no para descubrir el problema
        despues.
      </p>
      <QuienVeQue
        usuarios={listUsers().map((u) => u.userId)}
        equipos={listTeams().map((t) => ({ id: t.id, name: t.name }))}
        modulos={modulosDelArbol(getGeneralTree())}
      />
    </section>
  );
}
