import { describe, expect, it } from 'vitest';
import {
  generalTree,
  equipoEste,
  equipoNorte,
  paqueteReagrupado,
} from './__fixtures__/gobierno';
import type { ModulePackage } from './ModulePackage';
import { collectModuleIds, isFolder, type NavNode } from './NavigationTree';
import {
  accessibleModuleIds,
  buildNavigationView,
  canTeamAccessModule,
  findDanglingGrants,
} from './navigation';
import type { Team } from './Team';

const visibleModules = (tree: NavNode[]): string[] => tree.flatMap(collectModuleIds).sort();

describe('conceder una carpeta concede todo su contenido (4.10.6)', () => {
  it('conceder carpeta-regional da acceso a los modulos de sus subcarpetas', () => {
    expect([...accessibleModuleIds(generalTree, equipoNorte)].sort()).toEqual([
      'audiencias-norte',
      'casos-pendientes-norte',
      'casos-pendientes-este',
    ].sort());
  });

  it('no concede lo que vive fuera de la carpeta concedida', () => {
    expect(canTeamAccessModule(generalTree, equipoNorte, 'estadisticas-nacionales')).toBe(false);
  });

  it('conceder una subcarpeta concede solo esa rama', () => {
    expect([...accessibleModuleIds(generalTree, equipoEste)]).toEqual(['casos-pendientes-este']);
  });

  it('señala al Administrador los nodos concedidos que ya no existen', () => {
    const equipo: Team = { ...equipoNorte, grantedNodes: ['carpeta-regional', 'carpeta-borrada'] };
    expect(findDanglingGrants(generalTree, equipo)).toEqual(['carpeta-borrada']);
    // Y aun asi el acceso se resuelve con lo que si existe: falla cerrado, no rompe.
    expect(canTeamAccessModule(generalTree, equipo, 'audiencias-norte')).toBe(true);
  });
});

describe('sin paquete asignado: organizacion general podada', () => {
  it('muestra la estructura real, limitada a lo concedido', () => {
    const view = buildNavigationView({ generalTree: generalTree, team: equipoNorte });
    expect(view.fromPackage).toBe(false);
    expect(visibleModules(view.tree)).toEqual([
      'audiencias-norte',
      'casos-pendientes-este',
      'casos-pendientes-norte',
    ]);
    // 'estadisticas-nacionales' vive fuera de lo concedido y no aparece.
    expect(visibleModules(view.tree)).not.toContain('estadisticas-nacionales');
  });

  it('no muestra carpetas que quedan sin contenido accesible', () => {
    const view = buildNavigationView({ generalTree: generalTree, team: equipoEste });
    const nombresDeCarpeta = (nodes: NavNode[]): string[] =>
      nodes.flatMap((n) => (isFolder(n) ? [n.name, ...nombresDeCarpeta(n.children)] : []));
    expect(nombresDeCarpeta(view.tree)).not.toContain('Distrito Norte');
  });
});

describe('un paquete es una vista, nunca un permiso (4.1.3 y 4.10.6)', () => {
  it('reagrupa y reordena los modulos concedidos', () => {
    const view = buildNavigationView({
      generalTree: generalTree,
      team: equipoNorte,
      pkg: paqueteReagrupado,
    });
    expect(view.fromPackage).toBe(true);
    const carpetaVisual = view.tree[0];
    if (carpetaVisual?.type !== 'folder') throw new Error('se esperaba una carpeta visual');
    expect(carpetaVisual.name).toBe('Dia a dia');
    // Orden del paquete, distinto del de la organizacion general.
    expect(collectModuleIds(carpetaVisual)).toEqual(['audiencias-norte', 'casos-pendientes-norte']);
  });

  it('NO muestra un modulo que el paquete incluye pero el equipo no tiene concedido', () => {
    const view = buildNavigationView({
      generalTree: generalTree,
      team: equipoNorte,
      pkg: paqueteReagrupado,
    });
    expect(visibleModules(view.tree)).not.toContain('estadisticas-nacionales');
  });

  it('reporta explicitamente al Administrador el nodo que no pudo mostrar', () => {
    const view = buildNavigationView({
      generalTree: generalTree,
      team: equipoNorte,
      pkg: paqueteReagrupado,
    });
    expect(view.dangling).toEqual([
      {
        nodeId: 'nodo-estadisticas-nacionales',
        moduleId: 'estadisticas-nacionales',
        reason: 'fuera-de-lo-concedido',
      },
    ]);
  });

  it('distingue un modulo fuera de lo concedido de uno que ya no existe', () => {
    const pkg: ModulePackage = {
      id: 'p',
      name: 'p',
      visualTree: [
        {
          id: 'v1',
          type: 'folder',
          name: 'v',
          children: [
            { id: 'n1', type: 'module', moduleRef: { moduleId: 'borrado', slug: 'b', name: 'B' } },
          ],
        },
      ],
    };
    const view = buildNavigationView({ generalTree: generalTree, team: equipoNorte, pkg });
    expect(view.dangling[0]?.reason).toBe('no-existe-en-organizacion-general');
  });

  it('dos paquetes distintos presentan lo mismo de forma distinta, sin cambiar el acceso', () => {
    const plano: ModulePackage = {
      id: 'plano',
      name: 'Plano',
      visualTree: [
        { id: 'a', type: 'module', moduleRef: { moduleId: 'casos-pendientes-norte', slug: 's', name: 'A' } },
        { id: 'b', type: 'module', moduleRef: { moduleId: 'audiencias-norte', slug: 's', name: 'B' } },
      ],
    };
    const agrupado: ModulePackage = {
      id: 'agrupado',
      name: 'Agrupado',
      visualTree: [
        {
          id: 'g',
          type: 'folder',
          name: 'Todo junto',
          children: [
            { id: 'b', type: 'module', moduleRef: { moduleId: 'audiencias-norte', slug: 's', name: 'B' } },
            { id: 'a', type: 'module', moduleRef: { moduleId: 'casos-pendientes-norte', slug: 's', name: 'A' } },
          ],
        },
      ],
    };

    const v1 = buildNavigationView({ generalTree: generalTree, team: equipoNorte, pkg: plano });
    const v2 = buildNavigationView({ generalTree: generalTree, team: equipoNorte, pkg: agrupado });

    // Misma coleccion de modulos accesibles, presentada de dos formas distintas.
    expect(visibleModules(v1.tree)).toEqual(visibleModules(v2.tree));
    expect(v1.tree.every((n) => n.type === 'module')).toBe(true);
    expect(v2.tree[0]?.type).toBe('folder');
  });

  it('un paquete vacio de contenido accesible no deja carpetas visuales huerfanas', () => {
    const view = buildNavigationView({
      generalTree: generalTree,
      team: equipoEste,
      pkg: paqueteReagrupado,
    });
    expect(view.tree).toEqual([]);
    expect(view.dangling).toHaveLength(3);
  });
});
