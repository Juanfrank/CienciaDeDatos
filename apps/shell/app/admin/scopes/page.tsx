import { ScopeEditor, type ScopeTarget } from '../../../src/components/admin/ScopeEditor';
import { getGeneralTree, listTeams } from '../../../src/server/context';
import type { NavNode } from '@app/access-control';

export const dynamic = 'force-dynamic';

/** Carpetas del arbol, que son las que pueden llevar ambito propio (4.10.6). */
function carpetas(nodos: NavNode[], acumulado: ScopeTarget[] = []): ScopeTarget[] {
  for (const node of nodos) {
    if (node.type !== 'folder') continue;
    acumulado.push({
      tipo: 'carpeta',
      id: node.id,
      nombre: node.name,
      scope: node.scope ?? { restrictions: [] },
    });
    carpetas(node.children, acumulado);
  }
  return acumulado;
}

export default async function ScopesPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const { destino } = await searchParams;
  const targets: ScopeTarget[] = [
    ...(await listTeams()).map((t) => ({
      tipo: 'equipo' as const,
      id: t.id,
      nombre: t.name,
      scope: t.defaultScope,
    })),
    ...carpetas(await getGeneralTree()),
  ];

  return (
    <section>
      <h2>Ambitos de acceso</h2>
      <p className="muted-text">
        Cada capa solo puede RESTRINGIR respecto de la anterior. Ampliar es posible, pero exige
        una justificacion explicita y queda registrada aparte: el valor por defecto de cualquier
        combinacion de reglas es siempre "mas restrictivo o igual".
      </p>
      <ScopeEditor targets={targets} {...(destino ? { inicial: destino } : {})} />
    </section>
  );
}
