import { EditorDeEquipos } from '../../../src/components/admin/EditorDeEquipos';
import { administradores } from '../../../src/server/admin';
import { getGeneralTree, listTeams, listUsers } from '../../../src/server/contexto';
import { gobierno } from '../../../src/server/gobierno';
import type { NavNode } from '@app/access-control';

export const dynamic = 'force-dynamic';

function aplanar(nodos: NavNode[], acumulado: { id: string; nombre: string; tipo: string }[] = [], nivel = 0) {
  for (const node of nodos) {
    const sangria = '\u00a0\u00a0'.repeat(nivel);
    if (node.type === 'folder') {
      acumulado.push({ id: node.id, nombre: `${sangria}${node.name}`, tipo: 'folder' });
      aplanar(node.children, acumulado, nivel + 1);
    } else {
      acumulado.push({ id: node.id, nombre: `${sangria}${node.moduleRef.name}`, tipo: 'module' });
    }
  }
  return acumulado;
}

export default async function PaginaEquipos() {
  return (
    <section>
      <h2>Equipos y membresia</h2>
      <p className="texto-atenuado">
        Un equipo es la unit de agrupacion tanto para el acceso a modulos como para el ambito de
        datos por defecto. Su acceso se concede otorgando nodos del arbol real, para que el acceso
        y la estructura nunca diverjan.
      </p>
      <EditorDeEquipos
        administradores={await administradores()}
        equipos={await listTeams()}
        nodos={aplanar(await getGeneralTree())}
        usuarios={(await listUsers()).map((u) => u.userId)}
        paquetes={(await gobierno.listPackages()).map((p) => ({ id: p.id, name: p.name }))}
      />
    </section>
  );
}
