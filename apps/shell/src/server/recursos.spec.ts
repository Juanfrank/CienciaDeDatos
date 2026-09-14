import { describe, expect, it } from 'vitest';
import type { GridItem, ModuleDefinition } from '@app/module-model';
import { objectsOfModule } from './recursos';

/**
 * Que objetos tiene un modulo — seccion 4.5.
 *
 * Lo que la tabla de modulos ensena en la columna «Objetos» sale de aqui, y de aqui sale tambien
 * la decision de ofrecer o no «subir a la ultima» en cada fila. Ofrecerla donde no procede es
 * peor que no ofrecerla: quien la pulsa espera que pase algo.
 */

const item = (id: string, objectId: string, version: string): GridItem => ({
  id,
  position: { x: 0, y: 0, w: 3, h: 2 },
  instance: {
    instanceId: id,
    objectId,
    version,
    title: id,
    binding: { datasetId: 'd', dimensions: [], measures: [] },
  },
});

const moduloCon = (items: GridItem[]): ModuleDefinition =>
  ({
    moduleId: 'm-1',
    slug: 'm-1',
    name: 'Modulo',
    status: 'borrador',
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [{ pageId: 'p1', slug: 'general', name: 'General', items }],
  }) as ModuleDefinition;

describe('objectsOfModule', () => {
  it('agrupa por objeto Y version, no solo por objeto', () => {
    // Dos instancias del mismo objeto ancladas a versiones distintas son DOS filas. Agrupando
    // solo por objeto, la pantalla diria «tarjeta-kpi v1.0.0 ×2» y escondería que una de las dos
    // ya corre la version nueva — que es justo lo que se esta mirando.
    const objetos = objectsOfModule(
      moduloCon([
        item('a', 'tarjeta-kpi', '1.0.0'),
        item('b', 'tarjeta-kpi', '1.2.0'),
        item('c', 'tarjeta-kpi', '1.0.0'),
      ]),
    );

    expect(objetos).toHaveLength(2);
    expect(objetos.map((o) => [o.version, o.instancias])).toEqual([
      ['1.0.0', 2],
      ['1.2.0', 1],
    ]);
  });

  it('marca atrasada la version que no es la ultima, y solo esa', () => {
    const objetos = objectsOfModule(
      moduloCon([item('a', 'tarjeta-kpi', '1.0.0'), item('b', 'tarjeta-kpi', '1.2.0')]),
    );

    expect(objetos.find((o) => o.version === '1.0.0')?.atrasada).toBe(true);
    expect(objetos.find((o) => o.version === '1.2.0')?.atrasada).toBe(false);
    expect(objetos.every((o) => o.ultima === '1.2.0')).toBe(true);
  });

  it('un objeto que ya no esta en el catalogo no se ofrece para subir', () => {
    /*
     * Es el caso que importa y el que se colaria: sin definicion, `ultima` sale vacia y comparar
     * la version con la cadena vacia da «distinta», asi que la fila saldria atrasada y con su
     * boton de subir — a una version que no existe. `desconocido` es lo que hay que mirar.
     */
    const objetos = objectsOfModule(moduloCon([item('a', 'objeto-retirado', '1.0.0')]));

    expect(objetos).toHaveLength(1);
    expect(objetos[0]?.desconocido).toBe(true);
    expect(objetos[0]?.atrasada).toBe(false);
    expect(objetos[0]?.name).toBe('objeto-retirado');
  });

  it('recorre todas las paginas, no solo la primera', () => {
    const modulo = moduloCon([item('a', 'tarjeta-kpi', '1.2.0')]);
    const conDos: ModuleDefinition = {
      ...modulo,
      pages: [
        ...modulo.pages,
        { pageId: 'p2', slug: 'otra', name: 'Otra', items: [item('b', 'pastel', '1.0.0')] },
      ],
    };

    expect(objectsOfModule(conDos).map((o) => o.objectId).sort()).toEqual(['pastel', 'tarjeta-kpi']);
  });
});
