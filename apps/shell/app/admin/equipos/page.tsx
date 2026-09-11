import { EditorDeEquipos } from '../../../src/components/admin/EditorDeEquipos';
import { getGeneralTree, listTeams, listUsers } from '../../../src/server/contexto';
import { gobierno } from '../../../src/server/gobierno';
import type { NavNode } from '@app/access-control';

export const dynamic = 'force-dynamic';

function aplanar(nodos: NavNode[], acumulado: { id: string; nombre: string; tipo: string }[] = [], nivel = 0) {
  for (const nodo of nodos) {
    const sangria = '\u00a0\u00a0'.repeat(nivel);
    if (nodo.type === 'folder') {
      acumulado.push({ id: nodo.id, nombre: `${sangria}${nodo.name}`, tipo: 'folder' });
      aplanar(nodo.children, acumulado, nivel + 1);
    } else {
      acumulado.push({ id: nodo.id, nombre: `${sangria}${nodo.moduleRef.name}`, tipo: 'module' });
    }
  }
  return acumulado;
}

export default async function PaginaEquipos() {
  return (
    <section>
      <h2>Equipos y membresia</h2>
      <p className="texto-atenuado">
        Un equipo es la unidad de agrupacion tanto para el acceso a modulos como para el ambito de
        datos por defecto. Su acceso se concede otorgando nodos del arbol real, para que el acceso
        y la estructura nunca diverjan.
      </p>
      <EditorDeEquipos
        equipos={listTeams()}
        nodos={aplanar(getGeneralTree())}
        usuarios={listUsers().map((u) => u.userId)}
        paquetes={gobierno.listPackages().map((p) => ({ id: p.id, name: p.name }))}
      />
    </section>
  );
}
