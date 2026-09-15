import { buildNavigationView, isModule, type NavNode } from '@app/access-control';
import {
  PackageTable,
  type PackageCandidate,
  type PackageRow,
} from '../../../../src/components/admin/PackageTable';
import { getGeneralTree, listTeams } from '../../../../src/server/context';
import { governance } from '../../../../src/server/governance';
import { modules } from '../../../../src/server/moduleStore';
import { translator } from '../../../../src/server/locale';
import { paginaDeAdmin } from '../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/** Cuantos modulos referencia un arbol visual, en cualquier nivel. */
function modulosDe(nodos: NavNode[]): number {
  return nodos.reduce((n, nodo) => n + (isModule(nodo) ? 1 : modulosDe(nodo.children)), 0);
}

/**
 * Paquetes visuales — secciones 4.1.3 y 4.10.6.
 *
 * Era una lista de solo lectura: ensenaba lo que hubiera sembrado el seed y no habia forma de
 * crear uno. La API estaba entera desde el principio —`savePackage` con su validacion automatica
 * y su auditoria, y un borrado que ademas despega el paquete de los equipos que lo tuvieran— y no
 * la llamaba ninguna pantalla. Lo que faltaba eran los botones.
 */
export default async function PackagesPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const [t, paquetes, generalTree, equipos, definiciones] = await Promise.all([
    translator(),
    governance.listPackages(),
    getGeneralTree(),
    listTeams(),
    modules.list(),
  ]);

  const filas: PackageRow[] = paquetes.map((pkg) => {
    const asignados = equipos.filter((e) => e.assignedPackageId === pkg.id);
    return {
      pkg,
      equipos: asignados.map((e) => e.name),
      problemas: asignados.flatMap((equipo) =>
        buildNavigationView({ generalTree, team: equipo, pkg }).dangling.map((d) => ({
          equipo: equipo.name,
          moduleId: d.moduleId,
          reason: d.reason,
        })),
      ),
      modulos: modulosDe(pkg.visualTree),
    };
  });

  /*
   * Solo lo PUBLICADO se puede meter en un paquete.
   *
   * Un borrador no esta en la organizacion general, asi que un paquete que lo referenciara
   * quedaria colgante desde el momento de guardarlo: se ofreceria elegir algo que la validacion
   * automatica va a rechazar acto seguido.
   */
  const candidatos: PackageCandidate[] = definiciones
    .filter((m) => m.status === 'publicado')
    .map((m) => ({ moduleId: m.moduleId, slug: m.slug, name: m.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <section>
      <h2>{t('admin.packages.title')}</h2>
      <p className="muted-text">{t('admin.packages.intro')}</p>
      <PackageTable filas={filas} candidatos={candidatos} />
    </section>
  );
}
