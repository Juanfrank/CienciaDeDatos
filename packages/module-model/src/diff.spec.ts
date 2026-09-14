import { describe, expect, it } from 'vitest';
import type { GridItem, ModuleDefinition } from './ModuleDefinition';
import { diffModules } from './diff';

/** Que cambia entre dos versiones de un modulo — lo que le falta a quien aprueba. */

const item = (id: string, title: string, medida = 'CasosPendientes'): GridItem => ({
  id,
  position: { x: 0, y: 0, w: 3, h: 2 },
  instance: {
    instanceId: id,
    objectId: 'tarjeta-kpi',
    version: '1.0.0',
    title,
    binding: {
      datasetId: 'casos-por-distrito-trimestre',
      dimensions: [],
      measures: [medida],
    },
  },
});

const modulo = (
  name: string,
  paginas: { pageId: string; name: string; items: GridItem[] }[],
): Pick<ModuleDefinition, 'name' | 'pages'> => ({
  name,
  pages: paginas.map((p) => ({ ...p, slug: p.pageId })),
});

describe('diffModules', () => {
  it('sin cambios lo dice, en vez de devolver tres listas vacias que hay que interpretar', () => {
    const uno = modulo('Casos', [{ pageId: 'p1', name: 'General', items: [item('a', 'Pendientes')] }]);
    const d = diffModules(uno, uno);
    expect(d.identical).toBe(true);
  });

  it('anadir, quitar y cambiar un objeto se distinguen', () => {
    const antes = modulo('Casos', [
      { pageId: 'p1', name: 'General', items: [item('a', 'Pendientes'), item('b', 'Resueltos')] },
    ]);
    const despues = modulo('Casos', [
      {
        pageId: 'p1',
        name: 'General',
        items: [item('a', 'Pendientes', 'CasosResueltos'), item('c', 'Nuevos')],
      },
    ]);

    const d = diffModules(antes, despues);
    expect(d.addedObjects.map((o) => o.id)).toEqual(['c']);
    expect(d.removedObjects.map((o) => o.id)).toEqual(['b']);
    expect(d.changedObjects.map((o) => o.id)).toEqual(['a']);
    expect(d.identical).toBe(false);
  });

  /*
   * Es la razon de comparar por identidad y no por posicion en el array.
   *
   * Con una comparacion posicional, intercambiar dos objetos sale como «cambiaron los dos», y un
   * resumen que exagera se deja de leer igual que uno que miente.
   */
  it('reordenar sin tocar nada no se cuenta como que cambiaron todos', () => {
    const a = item('a', 'Pendientes');
    const b = item('b', 'Resueltos');
    const antes = modulo('Casos', [{ pageId: 'p1', name: 'General', items: [a, b] }]);
    const despues = modulo('Casos', [{ pageId: 'p1', name: 'General', items: [b, a] }]);

    const d = diffModules(antes, despues);
    expect(d.changedObjects).toEqual([]);
    expect(d.identical).toBe(true);
  });

  it('mover un objeto de sitio SI cuenta: la disposicion es parte de lo que se aprueba', () => {
    const antes = modulo('Casos', [{ pageId: 'p1', name: 'General', items: [item('a', 'Pendientes')] }]);
    const movido = { ...item('a', 'Pendientes'), position: { x: 6, y: 0, w: 3, h: 2 } };
    const despues = modulo('Casos', [{ pageId: 'p1', name: 'General', items: [movido] }]);

    expect(diffModules(antes, despues).changedObjects.map((o) => o.id)).toEqual(['a']);
  });

  it('las paginas anadidas y quitadas salen por su nombre, no por su identificador', () => {
    const antes = modulo('Casos', [{ pageId: 'p1', name: 'General', items: [] }]);
    const despues = modulo('Casos', [
      { pageId: 'p1', name: 'General', items: [] },
      { pageId: 'p2', name: 'Por distrito', items: [] },
    ]);

    const d = diffModules(antes, despues);
    expect(d.addedPages).toEqual(['Por distrito']);
    expect(d.removedPages).toEqual([]);
  });

  it('renombrar el modulo se ve, con el nombre de antes y el de despues', () => {
    const antes = modulo('Casos', [{ pageId: 'p1', name: 'General', items: [] }]);
    const despues = modulo('Casos pendientes', [{ pageId: 'p1', name: 'General', items: [] }]);

    expect(diffModules(antes, despues).renamed).toEqual({
      from: 'Casos',
      to: 'Casos pendientes',
    });
  });

  it('un objeto que cambia se nombra por su titulo y su pagina, no por su id', () => {
    const antes = modulo('Casos', [
      { pageId: 'p1', name: 'Resumen', items: [item('a', 'Pendientes')] },
    ]);
    const despues = modulo('Casos', [
      { pageId: 'p1', name: 'Resumen', items: [item('a', 'Pendientes', 'CasosResueltos')] },
    ]);

    expect(diffModules(antes, despues).changedObjects[0]).toEqual({
      id: 'a',
      title: 'Pendientes',
      pageName: 'Resumen',
    });
  });
});
