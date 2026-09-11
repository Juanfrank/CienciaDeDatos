import { ArbolNavegacion } from '../../src/components/ArbolNavegacion';
import { NavegacionPlegable } from '../../src/components/NavegacionPlegable';
import { findTeam, navigationFor } from '../../src/server/contexto';
import { exigirSesionDePagina } from '../../src/server/sesion';

/**
 * Disposicion de los modulos de negocio.
 *
 * El arbol de navegacion vive aqui y no en el layout raiz para que el panel de administracion
 * —que es otra superficie— no lo arrastre consigo.
 *
 * En pantalla estrecha el arbol se pliega (4.9). Antes ocupaba toda la parte de arriba y habia
 * que pasar por el entero —cabecera, selectores y el arbol completo— antes de llegar al modulo
 * que se venia a ver; en un movil eso son unos quinientos pixeles de desplazamiento.
 *
 * El plegado vive en `NavegacionPlegable`, que explica por que hace falta una linea de
 * JavaScript para decidir el estado inicial y por que el servidor lo emite abierto.
 */
export default async function ModulosLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesionDePagina();
  const equipo = await findTeam(sesion.activeTeamId);
  const navegacion = await navigationFor(sesion.activeTeamId);

  return (
    <div className="cuerpo">
      <NavegacionPlegable resumen={`Modulos de ${equipo?.name ?? 'sin equipo'}`}>
        <nav aria-label="Navegacion de modulos">
          <p className="lateral__titulo">{equipo?.name ?? 'Sin equipo'}</p>
          <ArbolNavegacion nodos={navegacion.tree} />
          {navegacion.tree.length === 0 ? (
            <p className="texto-atenuado">Este equipo no tiene modulos concedidos.</p>
          ) : null}
        </nav>
      </NavegacionPlegable>
      <main className="principal">{children}</main>
    </div>
  );
}
