import { describe, expect, it } from 'vitest';
import { dimensionKey } from './AccessScope';
import { DIM_DISTRITO, DIM_MATERIA, generalTree, norteTeam, scope, anaUser } from './__fixtures__/governance';
import { findNode, isFolder, type NavNode } from './NavigationTree';
import { resolveEffectiveScope } from './resolveEffectiveScope';
import {
  type Actor,
  type ManagedTree,
  applyTreeOperation,
  depthWarning,
} from './treeOperations';

const admin: Actor = { userId: 'admin-1', role: 'administrador' };
const colaborador: Actor = { userId: 'ana', role: 'colaborador' };
const visor: Actor = { userId: 'beto', role: 'visor' };

const arbol = (): ManagedTree => ({ nodes: JSON.parse(JSON.stringify(generalTree)) as NavNode[], trash: [] });

const esperarOk = (r: ReturnType<typeof applyTreeOperation>) => {
  if (!r.ok) throw new Error(`se esperaba ok: ${JSON.stringify(r)}`);
  return r;
};

const valuesOf = (t: ManagedTree, moduleId: string, dim: { table: string; field: string }) =>
  resolveEffectiveScope({
    user: anaUser,
    activeTeam: norteTeam,
    moduleId,
    generalTree: t.nodes,
  }).scope.restrictions.find((r) => dimensionKey(r.dimension) === dimensionKey(dim))?.allowedValues;

describe('permisos sobre el arbol: la comprobacion ocurre antes que nada', () => {
  it('un Visor no puede crear nada', () => {
    const r = applyTreeOperation(arbol(), { type: 'crear-carpeta', parentId: null, id: 'x', name: 'X' }, visor);
    expect(r.ok).toBe(false);
    if (r.ok || !('denial' in r)) throw new Error('se esperaba denegacion');
    expect(r.denial.capability).toBe('reorganizar-arbol-general');
  });

  it('un Colaborador puede crear un modulo borrador pero NO reorganizar el arbol', () => {
    const puede = applyTreeOperation(
      arbol(),
      { type: 'create-module', parentId: 'carpeta-norte', id: 'n1', moduleRef: { moduleId: 'm1', slug: 's1', name: 'M1' } },
      colaborador,
    );
    expect(puede.ok).toBe(true);

    const canNot = applyTreeOperation(
      arbol(),
      { type: 'mover', nodeId: 'nodo-audiencias-norte', newParentId: 'carpeta-este' },
      colaborador,
    );
    expect(canNot.ok).toBe(false);
  });

  it('solo un Administrador borra definitivamente', () => {
    const t = esperarOk(
      applyTreeOperation(arbol(), { type: 'enviar-a-papelera', nodeId: 'nodo-audiencias-norte' }, colaborador),
    ).tree;
    const r = applyTreeOperation(t, { type: 'borrar-definitivamente', trashedNodeId: 'nodo-audiencias-norte' }, colaborador);
    expect(r.ok).toBe(false);
  });
});

describe('mover es estructural, no cosmetico (4.1.2)', () => {
  it('mover un modulo entre carpetas con ambitos distintos cambia su ambito DE INMEDIATO', () => {
    const before = arbol();
    expect(valuesOf(before, 'audiencias-norte', DIM_DISTRITO)).toEqual(['Distrito Norte']);

    const r = esperarOk(
      applyTreeOperation(before, { type: 'mover', nodeId: 'nodo-audiencias-norte', newParentId: 'carpeta-este' }, admin),
    );

    expect(valuesOf(r.tree, 'audiencias-norte', DIM_DISTRITO)).toEqual(['Distrito Este']);
  });

  it('el evento de auditoria registra el ambito antes y despues, no solo que algo se movio', () => {
    const r = esperarOk(
      applyTreeOperation(arbol(), { type: 'mover', nodeId: 'nodo-audiencias-norte', newParentId: 'carpeta-este' }, admin),
    );
    const evento = r.audit[0];
    expect(evento?.action).toBe('mover');
    expect(evento?.scopeBefore?.restrictions[0]?.allowedValues).toEqual(['Distrito Norte']);
    expect(evento?.scopeAfter?.restrictions[0]?.allowedValues).toEqual(['Distrito Este']);
    expect(evento?.detail).toMatch(/cambio estructural/);
  });

  it('no permite mover una carpeta dentro de si misma', () => {
    const r = applyTreeOperation(
      arbol(),
      { type: 'mover', nodeId: 'carpeta-regional', newParentId: 'carpeta-norte' },
      admin,
    );
    expect(r.ok).toBe(false);
    if (r.ok || !('error' in r)) throw new Error('se esperaba error');
    expect(r.error).toMatch(/dentro de si mismo/);
  });

  it('no muta el arbol de entrada', () => {
    const original = arbol();
    const copia = JSON.stringify(original);
    applyTreeOperation(original, { type: 'mover', nodeId: 'nodo-audiencias-norte', newParentId: 'carpeta-este' }, admin);
    expect(JSON.stringify(original)).toBe(copia);
  });
});

describe('papelera: nunca borrado inmediato (4.1)', () => {
  it('enviar a la papelera saca el nodo del arbol pero lo conserva', () => {
    const r = esperarOk(
      applyTreeOperation(arbol(), { type: 'enviar-a-papelera', nodeId: 'nodo-audiencias-norte' }, admin),
    );
    expect(findNode(r.tree.nodes, 'nodo-audiencias-norte')).toBeNull();
    expect(r.tree.trash).toHaveLength(1);
    expect(r.tree.trash[0]?.previousParentId).toBe('carpeta-norte');
  });

  it('restaurar lo devuelve a su carpeta original, con su ambito original', () => {
    const enPapelera = esperarOk(
      applyTreeOperation(arbol(), { type: 'enviar-a-papelera', nodeId: 'nodo-audiencias-norte' }, admin),
    ).tree;
    const restaurado = esperarOk(
      applyTreeOperation(enPapelera, { type: 'restaurar', trashedNodeId: 'nodo-audiencias-norte' }, admin),
    ).tree;

    expect(findNode(restaurado.nodes, 'nodo-audiencias-norte')).not.toBeNull();
    expect(valuesOf(restaurado, 'audiencias-norte', DIM_DISTRITO)).toEqual(['Distrito Norte']);
  });

  it('si la carpeta original ya no existe, NO recuelga el nodo en la raiz', () => {
    // Recolgarlo en la raiz lo sacaria de una carpeta restrictiva: una ampliacion silenciosa.
    let t = esperarOk(
      applyTreeOperation(arbol(), { type: 'enviar-a-papelera', nodeId: 'nodo-audiencias-norte' }, admin),
    ).tree;
    t = esperarOk(applyTreeOperation(t, { type: 'enviar-a-papelera', nodeId: 'carpeta-norte' }, admin)).tree;

    const r = applyTreeOperation(t, { type: 'restaurar', trashedNodeId: 'nodo-audiencias-norte' }, admin);
    expect(r.ok).toBe(false);
    if (r.ok || !('error' in r)) throw new Error('se esperaba error');
    expect(r.error).toMatch(/cambiaria su ambito de acceso/);
  });

  it('borrar definitivamente solo funciona desde la papelera', () => {
    const r = applyTreeOperation(arbol(), { type: 'borrar-definitivamente', trashedNodeId: 'nodo-audiencias-norte' }, admin);
    expect(r.ok).toBe(false);
  });

  it('el borrado definitivo vacia la entrada de la papelera', () => {
    const enPapelera = esperarOk(
      applyTreeOperation(arbol(), { type: 'enviar-a-papelera', nodeId: 'nodo-audiencias-norte' }, admin),
    ).tree;
    const borrado = esperarOk(
      applyTreeOperation(enPapelera, { type: 'borrar-definitivamente', trashedNodeId: 'nodo-audiencias-norte' }, admin),
    ).tree;
    expect(borrado.trash).toHaveLength(0);
  });
});

describe('crear, renombrar y reordenar', () => {
  it('crea una carpeta con su propio ambito, que se hereda de inmediato', () => {
    const r = esperarOk(
      applyTreeOperation(
        arbol(),
        {
          type: 'crear-carpeta',
          parentId: 'carpeta-regional',
          id: 'carpeta-sur',
          name: 'Distrito Sur',
          scope: scope(DIM_DISTRITO, 'Distrito Sur'),
        },
        admin,
      ),
    );
    const withModule = esperarOk(
      applyTreeOperation(
        r.tree,
        { type: 'create-module', parentId: 'carpeta-sur', id: 'n-sur', moduleRef: { moduleId: 'casos-sur', slug: 'casos-sur', name: 'Casos Sur' } },
        admin,
      ),
    );
    // Regional permite Norte/Este/Sur; la carpeta nueva lo restringe a Sur.
    expect(valuesOf(withModule.tree, 'casos-sur', DIM_DISTRITO)).toEqual(['Distrito Sur']);
  });

  it('rechaza un id duplicado', () => {
    const r = applyTreeOperation(
      arbol(),
      { type: 'crear-carpeta', parentId: null, id: 'carpeta-norte', name: 'Duplicada' },
      admin,
    );
    expect(r.ok).toBe(false);
  });

  it('renombra una carpeta y lo registra', () => {
    const r = esperarOk(applyTreeOperation(arbol(), { type: 'renombrar', nodeId: 'carpeta-norte', name: 'Norte (nuevo)' }, admin));
    const node = findNode(r.tree.nodes, 'carpeta-norte');
    expect(node && isFolder(node) ? node.name : null).toBe('Norte (nuevo)');
    expect(r.audit[0]?.detail).toMatch(/de 'Distrito Norte' a 'Norte \(nuevo\)'/);
  });

  it('reordena dentro de la misma carpeta sin cambiar el ambito', () => {
    const before = valuesOf(arbol(), 'audiencias-norte', DIM_MATERIA);
    const r = esperarOk(applyTreeOperation(arbol(), { type: 'reordenar', nodeId: 'nodo-audiencias-norte', index: 0 }, admin));
    const carpeta = findNode(r.tree.nodes, 'carpeta-norte');
    if (!carpeta || !isFolder(carpeta)) throw new Error('se esperaba carpeta');
    expect(carpeta.children[0]?.id).toBe('nodo-audiencias-norte');
    expect(valuesOf(r.tree, 'audiencias-norte', DIM_MATERIA)).toEqual(before);
  });
});

describe('depthWarning (4.1.1)', () => {
  it('no advierte con una profundidad razonable', () => {
    expect(depthWarning(arbol(), 4)).toBeNull();
  });

  it('advierte, sin bloquear, cuando el anidamiento dificulta la navegacion', () => {
    expect(depthWarning(arbol(), 2)).toMatch(/niveles de profundidad/);
  });
});
