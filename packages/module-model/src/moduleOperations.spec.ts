import { describe, expect, it } from 'vitest';
import type { GridItem, ModulePage } from './ModuleDefinition';
import { applyModuleOperation, applyModuleOperations } from './moduleOperations';

/**
 * Una operacion por cambio — apartado 2.3.
 *
 * Lo que se comprueba aqui no es que sepa mover una caja: es que la operacion diga lo que CAMBIA y
 * no lo que queda, que es lo que permite componer dos cambios de dos personas sin que el segundo
 * borre al primero.
 */

const item = (id: string): GridItem => ({
  id,
  position: { x: 0, y: 0, w: 3, h: 2 },
  instance: {
    instanceId: id,
    objectId: 'tarjeta-kpi',
    version: '1.0.0',
    title: `Objeto ${id}`,
    binding: { datasetId: 'd', dimensions: [], measures: ['M'] },
  },
});

const pagina = (slug: string, items: GridItem[] = []): ModulePage => ({
  pageId: `pag-${slug}`,
  slug,
  name: slug,
  items,
});

const PAGINAS: ModulePage[] = [pagina('uno', [item('a'), item('b')]), pagina('dos', [item('c')])];

describe('operaciones sobre la definicion', () => {
  it('no muta lo que recibe', () => {
    const antes = JSON.stringify(PAGINAS);
    applyModuleOperation(PAGINAS, { kind: 'page-rename', pageSlug: 'uno', name: 'Otro' });

    // Quien la llama tiene las paginas anteriores dibujadas; mutarlas haria que React no lo viera.
    expect(JSON.stringify(PAGINAS)).toBe(antes);
  });

  it('renombra sin tocar el slug', () => {
    const r = applyModuleOperation(PAGINAS, {
      kind: 'page-rename',
      pageSlug: 'uno',
      name: 'Resumen',
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // El slug lo apuntan los saltos y los marcadores que alguien tenga guardados.
    expect(r.pages[0]).toMatchObject({ slug: 'uno', name: 'Resumen' });
  });

  it('mueve un objeto sin tocar su binding', () => {
    const r = applyModuleOperation(PAGINAS, {
      kind: 'item-move',
      pageSlug: 'uno',
      itemId: 'b',
      position: { x: 6, y: 4, w: 4, h: 3 },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pages[0]?.items[1]?.position).toEqual({ x: 6, y: 4, w: 4, h: 3 });
    expect(r.pages[0]?.items[1]?.instance.binding.measures).toEqual(['M']);
  });

  /*
   * Dos identificadores iguales son el MISMO objeto para la rejilla, para el panel y para los
   * complementos: editar uno editaria los dos y quitar uno los borraria a los dos.
   */
  it('no admite dos objetos con el mismo id, ni en otra pagina', () => {
    const r = applyModuleOperation(PAGINAS, { kind: 'item-add', pageSlug: 'dos', item: item('a') });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/ya existe/);
  });

  it('no deja quitar la unica pagina', () => {
    const r = applyModuleOperation([pagina('sola')], { kind: 'page-remove', pageSlug: 'sola' });

    // Un modulo sin paginas no se puede dibujar, y el editor se queda sin lienzo.
    expect(r.ok).toBe(false);
  });

  it('una pagina o un objeto que no existen se dicen, no se ignoran', () => {
    const sinPagina = applyModuleOperation(PAGINAS, {
      kind: 'item-remove',
      pageSlug: 'inventada',
      itemId: 'a',
    });
    expect(sinPagina.ok).toBe(false);

    const sinObjeto = applyModuleOperation(PAGINAS, {
      kind: 'item-remove',
      pageSlug: 'uno',
      itemId: 'inventado',
    });
    expect(sinObjeto.ok).toBe(false);
  });

  /*
   * El caso entero del apartado: dos cambios sobre cosas distintas se componen. Mandando las
   * paginas completas, el segundo en llegar borraba lo del primero aunque no se solaparan.
   */
  it('dos cambios sobre paginas distintas se componen', () => {
    const r = applyModuleOperations(PAGINAS, [
      { kind: 'page-rename', pageSlug: 'uno', name: 'Resumen' },
      { kind: 'item-add', pageSlug: 'dos', item: item('nuevo') },
    ]);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pages[0]?.name).toBe('Resumen');
    expect(r.pages[1]?.items.map((i) => i.id)).toEqual(['c', 'nuevo']);
  });

  it('una tanda que falla a la mitad no deja nada aplicado, y dice cual fallo', () => {
    const r = applyModuleOperations(PAGINAS, [
      { kind: 'page-rename', pageSlug: 'uno', name: 'Resumen' },
      { kind: 'item-remove', pageSlug: 'uno', itemId: 'inventado' },
    ]);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    // «No se pudo guardar» sobre una tanda de seis no dice donde mirar.
    expect(r.error).toMatch(/Operacion 2/);
  });
});
