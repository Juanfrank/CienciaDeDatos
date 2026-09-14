import { NavigationTree } from '../../src/components/NavigationTree';
import { CollapsibleNavigation } from '../../src/components/CollapsibleNavigation';
import { navigationOf } from '../../src/server/cicloDeVida';
import { findTeam, roleOf, teamsOf } from '../../src/server/context';
import { pageSessionRequire } from '../../src/server/session';

/** Disposicion de los modulos de negocio. */
export default async function LayoutModules({ children }: { children: React.ReactNode }) {
  const sesion = await pageSessionRequire();
  const equipo = await findTeam(sesion.activeTeamId);
  const navigation = await navigationOf(sesion);

  const equipos = await Promise.all(
    (await teamsOf(sesion.userId)).map(async (t) => ({
      id: t.id,
      name: t.name,
      role: await roleOf(sesion.userId, t.id),
    })),
  );

  return (
    <div className="cuerpo">
      <CollapsibleNavigation equipos={equipos} equipoActivo={sesion.activeTeamId}>
        <nav aria-label="Navegacion de modulos">
          <p className="sidebar__title">{equipo?.name ?? 'Sin equipo'}</p>
          <NavigationTree nodos={navigation.tree} />
          {navigation.tree.length === 0 ? (
            <p className="muted-text">Este equipo no tiene modulos concedidos.</p>
          ) : null}
        </nav>
      </CollapsibleNavigation>
      <main className="principal">{children}</main>
    </div>
  );
}
