import { redirect } from 'next/navigation';
import { isModule, type NavNode } from '@app/access-control';
import { navigationFor } from '../src/server/contexto';
import { obtenerSesion } from '../src/server/sesion';

/** Primer modulo accesible del arbol visible, o null si el equipo no tiene ninguno. */
function primerModulo(nodos: NavNode[]): string | null {
  for (const nodo of nodos) {
    if (isModule(nodo)) return nodo.moduleRef.slug;
    const dentro = primerModulo(nodo.children);
    if (dentro) return dentro;
  }
  return null;
}

export default async function Inicio() {
  const sesion = await obtenerSesion();
  const slug = primerModulo(navigationFor(sesion.activeTeamId).tree);

  if (slug) redirect(`/m/${slug}`);

  return (
    <div className="vacio">
      <h1>Sin modulos disponibles</h1>
      <p className="texto-atenuado">
        El equipo activo no tiene ningun modulo concedido en la organizacion general.
      </p>
    </div>
  );
}
