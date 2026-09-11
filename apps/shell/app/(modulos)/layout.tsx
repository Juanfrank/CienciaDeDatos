import { ArbolNavegacion } from '../../src/components/ArbolNavegacion';
import { findTeam, navigationFor } from '../../src/server/contexto';
import { obtenerSesion } from '../../src/server/sesion';

/**
 * Disposicion de los modulos de negocio.
 *
 * El arbol de navegacion vive aqui y no en el layout raiz para que el panel de administracion
 * —que es otra superficie— no lo arrastre consigo.
 */
export default async function ModulosLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  const equipo = findTeam(sesion.activeTeamId);
  const navegacion = navigationFor(sesion.activeTeamId);

  return (
    <div className="cuerpo">
      <nav className="lateral" aria-label="Navegacion de modulos">
        <p className="lateral__titulo">{equipo?.name ?? 'Sin equipo'}</p>
        <ArbolNavegacion nodos={navegacion.tree} />
        {navegacion.tree.length === 0 ? (
          <p className="texto-atenuado">Este equipo no tiene modulos concedidos.</p>
        ) : null}
      </nav>
      <main className="principal">{children}</main>
    </div>
  );
}
