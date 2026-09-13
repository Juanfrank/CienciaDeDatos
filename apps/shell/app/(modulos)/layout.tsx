import { ArbolNavegacion } from '../../src/components/ArbolNavegacion';
import { NavegacionPlegable } from '../../src/components/NavegacionPlegable';
import { navigationOf } from '../../src/server/cicloDeVida';
import { findTeam, roleOf, teamsOf } from '../../src/server/context';
import { exigirSesionDePagina } from '../../src/server/session';

/** Disposicion de los modulos de negocio. */
export default async function ModulosLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesionDePagina();
  const equipo = await findTeam(sesion.activeTeamId);
  const navegacion = await navigationOf(sesion);

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
