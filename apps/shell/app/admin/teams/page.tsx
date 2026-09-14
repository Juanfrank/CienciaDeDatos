import { TeamEditor } from '../../../src/components/admin/TeamEditor';
import { administradores } from '../../../src/server/admin';
import { getGeneralTree, listTeams, listUsers } from '../../../src/server/context';
import { governance } from '../../../src/server/governance';
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

export default async function TeamPage() {
  return (
    <section>
      <h2>Equipos y membresia</h2>
      <p className="muted-text">
        Un equipo es la unidad de agrupacion tanto para el acceso a modulos como para el ambito de
        datos por defecto. Su acceso se concede otorgando nodos del arbol real, para que el acceso
        y la estructura nunca diverjan.
      </p>
      <TeamEditor
        administradores={await administradores()}
        equipos={await listTeams()}
        nodos={aplanar(await getGeneralTree())}
        usuarios={(await listUsers()).map((u) => u.userId)}
        paquetes={(await governance.listPackages()).map((p) => ({ id: p.id, name: p.name }))}
      />
    </section>
  );
}
