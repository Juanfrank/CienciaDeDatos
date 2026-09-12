import { ArbolNavegacion } from '../../src/components/ArbolNavegacion';
import { NavegacionPlegable } from '../../src/components/NavegacionPlegable';
import { navegacionDe } from '../../src/server/cicloDeVida';
import { findTeam, roleOf, teamsOf } from '../../src/server/contexto';
import { exigirSesionDePagina } from '../../src/server/sesion';

/**
 * Disposicion de los modulos de negocio.
 *
 * El arbol de navegacion vive aqui y no en el layout raiz para que el panel de administracion
 * —que es otra superficie— no lo arrastre consigo.
 *
 * El panel se pliega desde el boton de la cabecera, a cualquier ancho. En pantalla estrecha
 * arranca plegado (4.9): antes ocupaba toda la parte de arriba y habia que pasar por el entero
 * —cabecera, selectores y el arbol completo— antes de llegar al modulo que se venia a ver.
 */
export default async function ModulosLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesionDePagina();
  const equipo = await findTeam(sesion.activeTeamId);
  const navegacion = await navegacionDe(sesion);

  const equipos = await Promise.all(
    (await teamsOf(sesion.userId)).map(async (t) => ({
      id: t.id,
      name: t.name,
      role: await roleOf(sesion.userId, t.id),
    })),
  );

  return (
    <div className="cuerpo">
      <NavegacionPlegable equipos={equipos} equipoActivo={sesion.activeTeamId}>
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
