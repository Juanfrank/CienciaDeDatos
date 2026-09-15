import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { NavNode } from '@app/access-control';
import { TeamPermissions } from '../../../../../src/components/admin/TeamPermissions';
import { getGeneralTree, listTeams } from '../../../../../src/server/context';
import { governance } from '../../../../../src/server/governance';
import { translator } from '../../../../../src/server/locale';
import { paginaDeAdmin } from '../../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/** El arbol, aplanado con su sangria, para la lista de casillas. */
function aplanar(
  nodos: NavNode[],
  acumulado: { id: string; nombre: string; tipo: string }[] = [],
  nivel = 0,
) {
  for (const node of nodos) {
    const sangria = '  '.repeat(nivel);
    if (node.type === 'folder') {
      acumulado.push({ id: node.id, nombre: `${sangria}${node.name}`, tipo: 'folder' });
      aplanar(node.children, acumulado, nivel + 1);
    } else {
      acumulado.push({ id: node.id, nombre: `${sangria}${node.moduleRef.name}`, tipo: 'module' });
    }
  }
  return acumulado;
}

/** Que alcanza un equipo — secciones 4.10.2 y 4.1.3. */
export default async function TeamPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const { id } = await params;
  const [t, equipos, arbol, paquetes] = await Promise.all([
    translator(),
    listTeams(),
    getGeneralTree(),
    governance.listPackages(),
  ]);

  const equipo = equipos.find((e) => e.id === id);
  if (!equipo) notFound();

  return (
    <section>
      <h2>{t('admin.teams.permissions.title', { equipo: equipo.name })}</h2>
      <p className="muted-text">{t('admin.teams.permissions.intro')}</p>

      <p>
        <Link href="/admin/teams">← {t('admin.teams.title')}</Link>
      </p>

      <TeamPermissions
        equipo={equipo}
        nodos={aplanar(arbol)}
        paquetes={paquetes.map((p) => ({ id: p.id, name: p.name }))}
      />
    </section>
  );
}
