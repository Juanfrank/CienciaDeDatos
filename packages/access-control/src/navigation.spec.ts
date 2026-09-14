import { describe, expect, it } from 'vitest';
import {
  generalTree,
  esteTeam,
  betoUser,
  norteTeam,
  regroupedPackage,
} from './__fixtures__/governance';
import type { ModulePackage } from './ModulePackage';
import { collectModuleIds, isFolder, type NavNode } from './NavigationTree';
import {
  accessibleModuleIds,
  buildNavigationView,
  canAccessModule,
  canTeamAccessModule,
  findDanglingGrants,
} from './navigation';
import type { Team } from './Team';

const visibleModules = (tree: NavNode[]): string[] => tree.flatMap(collectModuleIds).sort();

describe('conceder una carpeta concede todo su contenido (4.10.6)', () => {
  it('conceder carpeta-regional da acceso a los modulos de sus subcarpetas', () => {
    expect([...accessibleModuleIds(generalTree, norteTeam)].sort()).toEqual([
      'audiencias-norte',
      'casos-pendientes-norte',
      'casos-pendientes-este',
    ].sort());
  });

  it('no concede lo que vive fuera de la carpeta concedida', () => {
    expect(canTeamAccessModule(generalTree, norteTeam, 'estadisticas-nacionales')).toBe(false);
  });

  it('conceder una subcarpeta concede solo esa rama', () => {
    expect([...accessibleModuleIds(generalTree, esteTeam)]).toEqual(['casos-pendientes-este']);
  });

  it('señala al Administrador los nodos concedidos que ya no existen', () => {
    const equipo: Team = { ...norteTeam, grantedNodes: ['carpeta-regional', 'carpeta-borrada'] };
    expect(findDanglingGrants(generalTree, equipo)).toEqual(['carpeta-borrada']);
    // Y aun asi el acceso se resuelve con lo que si existe: falla cerrado, no rompe.
    expect(canTeamAccessModule(generalTree, equipo, 'audiencias-norte')).toBe(true);
  });
});

describe('sin paquete asignado: organizacion general podada', () => {
  it('muestra la estructura real, limitada a lo concedido', () => {
    const view = buildNavigationView({ generalTree: generalTree, team: norteTeam });
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
    const view = buildNavigationView({ generalTree: generalTree, team: esteTeam });
    const folderNames = (nodes: NavNode[]): string[] =>
      nodes.flatMap((n) => (isFolder(n) ? [n.name, ...folderNames(n.children)] : []));
    expect(folderNames(view.tree)).not.toContain('Distrito Norte');
  });
});

describe('un paquete es una vista, nunca un permiso (4.1.3 y 4.10.6)', () => {
  it('reagrupa y reordena los modulos concedidos', () => {
    const view = buildNavigationView({
      generalTree: generalTree,
      team: norteTeam,
      pkg: regroupedPackage,
    });
    expect(view.fromPackage).toBe(true);
    const visualFolder = view.tree[0];
    if (visualFolder?.type !== 'folder') throw new Error('se esperaba una carpeta visual');
    expect(visualFolder.name).toBe('Dia a dia');
    // Orden del paquete, distinto del de la organizacion general.
    expect(collectModuleIds(visualFolder)).toEqual(['audiencias-norte', 'casos-pendientes-norte']);
  });

  it('NO muestra un modulo que el paquete incluye pero el equipo no tiene concedido', () => {
    const view = buildNavigationView({
      generalTree: generalTree,
      team: norteTeam,
      pkg: regroupedPackage,
    });
    expect(visibleModules(view.tree)).not.toContain('estadisticas-nacionales');
  });

  it('reporta explicitamente al Administrador el nodo que no pudo mostrar', () => {
    const view = buildNavigationView({
      generalTree: generalTree,
      team: norteTeam,
      pkg: regroupedPackage,
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
    const view = buildNavigationView({ generalTree: generalTree, team: norteTeam, pkg });
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

    const v1 = buildNavigationView({ generalTree: generalTree, team: norteTeam, pkg: plano });
    const v2 = buildNavigationView({ generalTree: generalTree, team: norteTeam, pkg: agrupado });

    // Misma coleccion de modulos accesibles, presentada de dos formas distintas.
    expect(visibleModules(v1.tree)).toEqual(visibleModules(v2.tree));
    expect(v1.tree.every((n) => n.type === 'module')).toBe(true);
    expect(v2.tree[0]?.type).toBe('folder');
  });

  it('un paquete vacio de contenido accesible no deja carpetas visuales huerfanas', () => {
    const view = buildNavigationView({
      generalTree: generalTree,
      team: esteTeam,
      pkg: regroupedPackage,
    });
    expect(view.tree).toEqual([]);
    expect(view.dangling).toHaveLength(3);
  });
});

describe('ocultar un nodo lo quita de la vista Y del acceso', () => {
  /*
   * Ocultar no puede ser solo cosmetico.
   *
   * Si el nodo desapareciera del menu pero `accessibleModuleIds` lo siguiera devolviendo, el
   * modulo seguiria sirviendose en `/m/{slug}` a quien conociera la direccion. Eso es
   * ocultamiento de interfaz, que es lo que el criterio de la seccion 9 dice expresamente que no
   * basta. Las dos comprobaciones van juntas a proposito: la del menu sola pasaria igual.
   */
  const ocultar = (tree: NavNode[], nodeId: string): NavNode[] =>
    tree.map((nodo) => {
      if (nodo.id === nodeId) return { ...nodo, hidden: true };
      return isFolder(nodo) ? { ...nodo, children: ocultar(nodo.children, nodeId) } : nodo;
    });

  /** El nodo de un modulo concreto dentro del arbol de pruebas. */
  const nodoDe = (tree: NavNode[], moduleId: string): string => {
    for (const nodo of tree) {
      if (!isFolder(nodo)) {
        if (nodo.moduleRef.moduleId === moduleId) return nodo.id;
        continue;
      }
      const encontrado = nodoDe(nodo.children, moduleId);
      if (encontrado) return encontrado;
    }
    return '';
  };

  it('un modulo oculto deja de estar accesible y deja de dibujarse', () => {
    const nodeId = nodoDe(generalTree, 'audiencias-norte');
    expect(nodeId).not.toBe('');
    const conOculto = ocultar(generalTree, nodeId);

    expect(accessibleModuleIds(conOculto, norteTeam).has('audiencias-norte')).toBe(false);
    expect(canTeamAccessModule(conOculto, norteTeam, 'audiencias-norte')).toBe(false);
    expect(visibleModules(buildNavigationView({ generalTree: conOculto, team: norteTeam }).tree)).not.toContain(
      'audiencias-norte',
    );
  });

  it('y solo ese: lo que estaba al lado se sigue viendo', () => {
    const conOculto = ocultar(generalTree, nodoDe(generalTree, 'audiencias-norte'));
    expect(accessibleModuleIds(conOculto, norteTeam).has('casos-pendientes-norte')).toBe(true);
  });

  it('ocultar una CARPETA se lleva consigo todo lo que contiene', () => {
    // Es lo que se espera al retirar una rama entera mientras se reorganiza: no hay que ir nodo
    // por nodo.
    const carpeta = generalTree.find(isFolder);
    expect(carpeta).toBeDefined();
    const conOculta = ocultar(generalTree, (carpeta as { id: string }).id);

    expect([...accessibleModuleIds(conOculta, norteTeam)]).toEqual([]);
    expect(buildNavigationView({ generalTree: conOculta, team: norteTeam }).tree).toEqual([]);
  });
});


describe('concesion individual: la excepcion nominal (4.10.6)', () => {
  /*
   * Es un SEGUNDO camino de acceso, y la unica forma de que no se vuelva una mentira es que todo
   * lo que pregunte «alcanza esta persona esto» lo mire. Por eso las pruebas van sobre las tres
   * puertas por las que se entra —la union, la pregunta completa y el menu— y no sobre el campo.
   *
   * `beto` esta en el equipo del Distrito Este, que no alcanza nada del Norte.
   */
  const conNorte = { ...betoUser, grantedNodes: ['carpeta-norte'] };

  it('sin concesion individual, el equipo manda y no alcanza lo ajeno', () => {
    expect(canTeamAccessModule(generalTree, esteTeam, 'audiencias-norte')).toBe(false);
    expect(
      canAccessModule({ generalTree, team: esteTeam, user: betoUser, moduleId: 'audiencias-norte' }),
    ).toBe(false);
  });

  it('concedido a su nombre, lo alcanza aunque su equipo no lo tenga', () => {
    // El equipo sigue sin alcanzarlo: lo que cambio es lo que alcanza LA PERSONA. Las dos
    // afirmaciones van juntas porque separar equipo de persona es justo lo que se anadio.
    expect(canTeamAccessModule(generalTree, esteTeam, 'audiencias-norte')).toBe(false);
    expect(
      canAccessModule({ generalTree, team: esteTeam, user: conNorte, moduleId: 'audiencias-norte' }),
    ).toBe(true);
    expect(accessibleModuleIds(generalTree, esteTeam, conNorte).has('audiencias-norte')).toBe(true);
  });

  it('lo concedido a su nombre aparece en SU MENU, no solo en la comprobacion', () => {
    // Conceder sin que se vea es un boton que escribe y no concede. Se comprueba el arbol que
    // se dibuja, que es donde la persona lo busca.
    const sinElla = visibleModules(buildNavigationView({ generalTree, team: esteTeam }).tree);
    const conElla = visibleModules(
      buildNavigationView({ generalTree, team: esteTeam, user: conNorte }).tree,
    );
    expect(sinElla).not.toContain('audiencias-norte');
    expect(conElla).toContain('audiencias-norte');
  });

  it('una carpeta oculta se lleva tambien lo concedido a una persona', () => {
    // La concesion individual no es una puerta trasera al ocultamiento: si lo fuera, ocultar una
    // rama dejaria de ser una forma de retirarla mientras se reorganiza.
    const esconder = (nodos: NavNode[]): NavNode[] =>
      nodos.map((nodo) => {
        if (nodo.id === 'carpeta-norte') return { ...nodo, hidden: true };
        return isFolder(nodo) ? { ...nodo, children: esconder(nodo.children) } : nodo;
      });
    const oculto = esconder(generalTree);
    expect(
      canAccessModule({
        generalTree: oculto,
        team: esteTeam,
        user: conNorte,
        moduleId: 'audiencias-norte',
      }),
    ).toBe(false);
  });
});
