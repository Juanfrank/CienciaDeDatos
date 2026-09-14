import { redirect } from 'next/navigation';
import { isModule, type NavNode } from '@app/access-control';
import { navigationOf } from '../../src/server/cicloDeVida';
import { pageSessionRequire } from '../../src/server/session';

/** Primer modulo accesible del arbol visible, o null si el equipo no tiene ninguno. */
function moduleFirst(nodos: NavNode[]): string | null {
  for (const node of nodos) {
    if (isModule(node)) return node.moduleRef.slug;
    const dentro = moduleFirst(node.children);
    if (dentro) return dentro;
  }
  return null;
}

export default async function Home() {
  const sesion = await pageSessionRequire();
  const slug = moduleFirst((await navigationOf(sesion)).tree);

  if (slug) redirect(`/m/${slug}`);

  return (
    <div className="vacio">
      <h1>Sin modulos disponibles</h1>
      <p className="muted-text">
        El equipo activo no tiene ningun modulo concedido en la organizacion general.
      </p>
    </div>
  );
}
