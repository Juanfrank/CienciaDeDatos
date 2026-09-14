import { describe, expect, it } from 'vitest';
import type { NavNode } from '@app/access-control';
import type { ModuleDefinition } from '@app/module-model';
import { looseModules, organizationRows } from './organizacion';

/** El arbol aplanado en filas — secciones 4.1 y 4.10.6. */

const modulo = (moduleId: string, name: string): ModuleDefinition =>
  ({
    moduleId,
    slug: moduleId,
    name,
    status: 'publicado',
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [],
  }) as unknown as ModuleDefinition;

const hoja = (moduleId: string, name: string): NavNode => ({
  id: `nodo-${moduleId}`,
  type: 'module',
  moduleRef: { moduleId, slug: moduleId, name },
});

const definiciones = new Map([
  ['m-a', modulo('m-a', 'Alfa')],
  ['m-b', modulo('m-b', 'Beta')],
  ['m-c', modulo('m-c', 'Gama')],
]);

const arbol: NavNode[] = [
  {
    id: 'norte',
    type: 'folder',
    name: 'Norte',
    scope: { restrictions: [{ dimension: { table: 'T', field: 'D' }, allowedValues: ['norte'] }] },
    children: [
      hoja('m-b', 'Beta'),
      { id: 'sub', type: 'folder', name: 'Subcarpeta', children: [hoja('m-c', 'Gama')] },
    ],
  },
  hoja('m-a', 'Alfa'),
];

describe('organizationRows', () => {
  it('devuelve el arbol en SU orden, no ordenado por nombre', () => {
    /*
     * El orden del arbol es el contrato.
     *
     * Ordenar la vista por nombre se leia bien mientras la tabla solo se mirara; con flechas de
     * subir y bajar en cada fila pasa a ser mentira, porque esas flechas mueven el orden real y
     * la pantalla ensenaria otro. En el arbol de prueba, `Beta` va antes que la `Subcarpeta` y
     * `Alfa` va al final: por nombre saldrian al reves.
     */
    expect(
      organizationRows(arbol, definiciones).map((f) => [
        f.tipo,
        f.profundidad,
        f.indice,
        f.tipo === 'carpeta' ? f.nombre : f.modulo.name,
      ]),
    ).toEqual([
      ['carpeta', 0, 0, 'Norte'],
      ['modulo', 1, 0, 'Beta'],
      ['carpeta', 1, 1, 'Subcarpeta'],
      ['modulo', 2, 0, 'Gama'],
      ['modulo', 0, 1, 'Alfa'],
    ]);
  });

  it('cada fila sabe cuantos hermanos tiene, para apagar la flecha del extremo', () => {
    const filas = organizationRows(arbol, definiciones);
    // La raiz tiene dos nodos: la carpeta Norte y el modulo Alfa.
    expect(filas[0]?.hermanos).toBe(2);
    expect(filas[filas.length - 1]?.indice).toBe(1);
  });

  it('una carpeta cuenta los modulos de sus subcarpetas, no solo los suyos', () => {
    // Contar solo los hijos directos diria «1 modulo» de una carpeta con veinte dentro repartidos
    // en subcarpetas, que es justo la que hay que mirar antes de tocarle el ambito.
    const norte = organizationRows(arbol, definiciones).find(
      (f) => f.tipo === 'carpeta' && f.nombre === 'Norte',
    );
    expect(norte?.tipo === 'carpeta' && norte.modulos).toBe(2);
  });

  it('lleva el ambito propio de la carpeta, y no inventa uno donde no lo hay', () => {
    const filas = organizationRows(arbol, definiciones);
    const norte = filas.find((f) => f.tipo === 'carpeta' && f.nombre === 'Norte');
    const sub = filas.find((f) => f.tipo === 'carpeta' && f.nombre === 'Subcarpeta');
    expect(norte?.tipo === 'carpeta' && norte.scope?.restrictions).toHaveLength(1);
    expect(sub?.tipo === 'carpeta' && sub.scope).toBeUndefined();
  });

  it('omite la referencia a un modulo que ya no existe, en vez de dibujarla a medias', () => {
    const conColgante: NavNode[] = [...arbol, hoja('m-borrado', 'Borrado')];
    const filas = organizationRows(conColgante, definiciones);
    expect(filas.filter((f) => f.tipo === 'modulo')).toHaveLength(3);
  });
});

describe('looseModules', () => {
  it('devuelve los que el arbol no coloca en ninguna parte', () => {
    /*
     * Un borrador recien creado no esta en la organizacion general: entra al publicarse. Sin esta
     * lista desapareceria de la pantalla al pasar de lista plana a arbol, y perder de vista lo que
     * no esta colocado seria peor que la lista plana de antes.
     */
    const conSuelto = new Map(definiciones);
    conSuelto.set('m-z', modulo('m-z', 'Zeta'));

    expect(looseModules(arbol, conSuelto).map((m) => m.moduleId)).toEqual(['m-z']);
  });

  it('y ninguno cuando todos estan colocados', () => {
    expect(looseModules(arbol, definiciones)).toEqual([]);
  });
});
