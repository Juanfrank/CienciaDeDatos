import { getGeneralTree, listTeams } from '../../../src/server/contexto';
import { gobierno } from '../../../src/server/gobierno';
import { buildNavigationView } from '@app/access-control';

export const dynamic = 'force-dynamic';

/**
 * Paquetes visuales — secciones 4.1.3 y 4.10.6.
 *
 * Muestra, por cada paquete asignado, que nodos NO se mostrarian a su audiencia por no estar
 * concedidos. El documento pide que eso se señale explicitamente al Administrador, no que se
 * oculte sin aviso.
 *
 * La seguridad no depende de esta vista: aunque un paquete incluya un modulo no concedido,
 * `buildNavigationView` no lo muestra. Esto existe para que el Administrador lo SEPA.
 */
export default async function PaginaPaquetes() {
  const paquetes = gobierno.listPackages();
  const generalTree = getGeneralTree();
  const equipos = listTeams();

  return (
    <section>
      <h2>Paquetes visuales</h2>
      <p className="texto-atenuado">
        Un paquete reagrupa, renombra y reordena lo que una audiencia ya puede ver. Es una vista,
        no un permiso: la resolucion de ambito nunca consulta un paquete, solo la organizacion
        general.
      </p>

      {paquetes.length === 0 ? (
        <p className="texto-atenuado" data-testid="sin-paquetes">
          No hay paquetes definidos. Los equipos sin paquete ven la organizacion general tal cual,
          limitada a lo que su ambito permite.
        </p>
      ) : (
        <ul className="lista-simple" data-testid="lista-paquetes">
          {paquetes.map((pkg) => {
            const usuarios = equipos.filter((t) => t.assignedPackageId === pkg.id);
            const problemas = usuarios.flatMap((equipo) =>
              buildNavigationView({ generalTree, team: equipo, pkg }).dangling.map((d) => ({
                equipo: equipo.name,
                ...d,
              })),
            );

            return (
              <li key={pkg.id} data-testid={`paquete-${pkg.id}`}>
                <strong>{pkg.name}</strong>
                <span className="texto-atenuado">
                  {' '}· asignado a {usuarios.length} equipo(s)
                </span>
                {problemas.length > 0 ? (
                  <div className="aviso aviso--atencion" data-testid={`paquete-problemas-${pkg.id}`}>
                    <p>
                      <strong>{problemas.length} nodo(s) no se muestran</strong> porque la
                      audiencia no los tiene concedidos:
                    </p>
                    <ul>
                      {problemas.map((p, i) => (
                        <li key={i}>
                          <code>{p.moduleId}</code> para {p.equipo} — {p.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
