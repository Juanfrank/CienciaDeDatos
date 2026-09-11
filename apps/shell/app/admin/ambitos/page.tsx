import { EditorDeAmbito, type DestinoDeAmbito } from '../../../src/components/admin/EditorDeAmbito';
import { getGeneralTree, listTeams } from '../../../src/server/contexto';
import type { NavNode } from '@app/access-control';

export const dynamic = 'force-dynamic';

/** Carpetas del arbol, que son las que pueden llevar ambito propio (4.10.6). */
function carpetas(nodos: NavNode[], acumulado: DestinoDeAmbito[] = []): DestinoDeAmbito[] {
  for (const nodo of nodos) {
    if (nodo.type !== 'folder') continue;
    acumulado.push({
      tipo: 'carpeta',
      id: nodo.id,
      nombre: nodo.name,
      scope: nodo.scope ?? { restrictions: [] },
    });
    carpetas(nodo.children, acumulado);
  }
  return acumulado;
}

export default async function PaginaAmbitos() {
  const destinos: DestinoDeAmbito[] = [
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
      <p className="texto-atenuado">
        Cada capa solo puede RESTRINGIR respecto de la anterior. Ampliar es posible, pero exige
        una justificacion explicita y queda registrada aparte: el valor por defecto de cualquier
        combinacion de reglas es siempre "mas restrictivo o igual".
      </p>
      <EditorDeAmbito destinos={destinos} />
    </section>
  );
}
