import { describe, expect, it } from 'vitest';
import { ObjectRegistry, catalogoInicial, type ObjectInstance } from '@app/ui-components';
import {
  datasetsConsumedBy,
  findPage,
  moduleUrl,
  type GridItem,
  type ModuleDefinition,
} from './ModuleDefinition';
import {
  GRID_COLUMNS,
  findFreeSlot,
  layoutForBreakpoint,
  layoutsForAllBreakpoints,
  readingOrder,
  rowSpanForBreakpoint,
  validateLayout,
} from './grid';
import {
  applyPersonalization,
  assertPersonalizationIsPresentationOnly,
  describeProvenance,
} from './personalization';
import { findPublishBlockers, validateModule } from './validation';

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };

const objectInstance = (
  id: string,
  objectId: string,
  version = '1.0.0',
  overrides: Partial<ObjectInstance['binding']> = {},
): ObjectInstance => ({
  instanceId: id,
  objectId,
  version,
  binding: { datasetId: 'casos', dimensions: [DISTRITO], measures: ['CasosPendientes'], ...overrides },
});

const item = (id: string, objectId: string, position = { x: 0, y: 0, w: 6, h: 2 }): GridItem => ({
  id,
  instance: objectInstance(id, objectId),
  position,
});

const modulo = (items: GridItem[]): ModuleDefinition => ({
  moduleId: 'casos-pendientes',
  slug: 'casos-pendientes',
  name: 'Casos pendientes',
  status: 'borrador',
  pages: [{ pageId: 'p1', slug: 'general', name: 'General', items }],
  version: 1,
  createdAt: '2026-09-11T08:00:00.000Z',
  updatedAt: '2026-09-11T08:00:00.000Z',
});

const registro = new ObjectRegistry(catalogoInicial);
const gridColumns = { casos: ['DimTribunal.Distrito', 'CasosPendientes'] };

describe('rejilla (4.2)', () => {
  it('acepta una disposicion valida', () => {
    expect(
      validateLayout([
        { id: 'a', position: { x: 0, y: 0, w: 6, h: 2 } },
        { id: 'b', position: { x: 6, y: 0, w: 6, h: 2 } },
      ]),
    ).toEqual([]);
  });

  it('detecta solapamientos: un objeto encima de otro oculta datos sin que nadie lo note', () => {
    const problems = validateLayout([
      { id: 'a', position: { x: 0, y: 0, w: 6, h: 2 } },
      { id: 'b', position: { x: 3, y: 1, w: 6, h: 2 } },
    ]);
    expect(problems[0]?.kind).toBe('solapamiento');
    expect(problems[0]?.itemIds).toEqual(['a', 'b']);
  });

  it('detecta un objeto que se sale de las doce columnas', () => {
    const problems = validateLayout([{ id: 'a', position: { x: 8, y: 0, w: 6, h: 2 } }]);
    expect(problems[0]?.kind).toBe('fuera-de-rejilla');
  });

  it('detecta tamanos invalidos', () => {
    expect(validateLayout([{ id: 'a', position: { x: 0, y: 0, w: 0, h: 2 } }])[0]?.kind).toBe(
      'tamano-invalido',
    );
  });

  it('objetos adyacentes no se consideran solapados', () => {
    expect(
      validateLayout([
        { id: 'a', position: { x: 0, y: 0, w: 6, h: 2 } },
        { id: 'b', position: { x: 0, y: 2, w: 6, h: 2 } },
      ]),
    ).toEqual([]);
  });
});

describe('responsividad: una sola disposicion guardada', () => {
  const items = [
    { id: 'a', position: { x: 0, y: 0, w: 6, h: 2 } },
    { id: 'b', position: { x: 6, y: 0, w: 6, h: 2 } },
    { id: 'c', position: { x: 0, y: 2, w: 12, h: 3 } },
  ];

  it('en escritorio respeta la disposicion guardada', () => {
    expect(layoutForBreakpoint(items, 'escritorio')).toEqual(items);
  });

  it('en movil apila todo a una columna, en orden de lectura', () => {
    const movil = layoutForBreakpoint(items, 'movil');
    expect(movil.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(movil.every((i) => i.position.w === 1 && i.position.x === 0)).toBe(true);
  });

  it('en tableta escala proporcionalmente y reflowa en vez de recortar', () => {
    const tableta = layoutForBreakpoint(items, 'tableta');
    // 6 de 12 columnas se convierte en 3 de 6.
    expect(tableta.find((i) => i.id === 'a')?.position.w).toBe(3);
    // El que ocupaba las doce ocupa las seis, y baja de fila.
    const c = tableta.find((i) => i.id === 'c');
    expect(c?.position.w).toBe(6);
    expect(c?.position.x).toBe(0);
  });

  it('ningun objeto se sale de la rejilla estrecha', () => {
    for (const bp of ['movil', 'tableta', 'escritorio'] as const) {
      const columnasBp = bp === 'movil' ? 1 : bp === 'tableta' ? 6 : GRID_COLUMNS;
      for (const i of layoutForBreakpoint(items, bp)) {
        expect(i.position.x + i.position.w).toBeLessThanOrEqual(columnasBp);
      }
    }
  });
});

describe('las tres disposiciones salen de una sola guardada', () => {
  const items = [
    { id: 'a', position: { x: 0, y: 0, w: 3, h: 2 } },
    { id: 'b', position: { x: 3, y: 0, w: 9, h: 2 } },
    { id: 'c', position: { x: 0, y: 2, w: 12, h: 4 } },
  ];

  it('layoutsForAllBreakpoints devuelve las tres indexadas por id', () => {
    const d = layoutsForAllBreakpoints(items);
    expect(d.escritorio.get('b')).toEqual({ x: 3, y: 0, w: 9, h: 2 });
    expect(d.movil.get('b')?.w).toBe(1);
    expect(d.tableta.get('b')?.w).toBeLessThan(6);
  });

  it('el orden de lectura es el mismo que usa la disposicion estrecha', () => {
    // De ahi que el DOM se emita en ese orden: es lo que hace que la colocacion automatica de
    // CSS Grid reproduzca las tres disposiciones desde un mismo DOM.
    const revueltos = [items[2], items[0], items[1]].filter((i) => i !== undefined);
    expect(readingOrder(revueltos).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('en una sola columna el alto lo marca el contenido, no el guardado', () => {
    // Un alto elegido para equilibrar doce columnas, aplicado a una, deja cajas medio vacias.
    expect(rowSpanForBreakpoint(4, 'movil')).toBeNull();
    expect(rowSpanForBreakpoint(4, 'tableta')).toBe(4);
    expect(rowSpanForBreakpoint(4, 'escritorio')).toBe(4);
  });
});

describe('findFreeSlot', () => {
  it('encuentra hueco a la derecha si cabe', () => {
    expect(findFreeSlot([{ position: { x: 0, y: 0, w: 6, h: 2 } }], 6, 2)).toEqual({
      x: 6, y: 0, w: 6, h: 2,
    });
  });

  it('baja de fila si no cabe', () => {
    expect(findFreeSlot([{ position: { x: 0, y: 0, w: 12, h: 2 } }], 6, 2)).toMatchObject({
      x: 0, y: 2,
    });
  });
});

describe('validateModule (4.2): marcar roto, no fallar en silencio', () => {
  it('un modulo coherente no reporta nada roto', () => {
    const d = validateModule({
      module: modulo([item('a', 'barras')]),
      registry: registro,
      columnsByDataset: gridColumns,
    });
    expect(d.hasBrokenItems).toBe(false);
  });

  it('marca roto un objeto cuya version ya no existe, sin tumbar el editor', () => {
    const roto = modulo([item('a', 'barras')]);
    const first = roto.pages[0]?.items[0];
    if (!first) throw new Error('fixture inesperado');
    first.instance = { ...first.instance, version: '9.9.9' };

    const d = validateModule({ module: roto, registry: registro, columnsByDataset: gridColumns });
    expect(d.items[0]?.broken).toBe(true);
    expect(d.items[0]?.unresolvedObject).toMatch(/no tiene la version/);
  });

  it('marca roto un campo que ya no existe en el dataset', () => {
    const d = validateModule({
      module: modulo([item('a', 'barras')]),
      registry: registro,
      columnsByDataset: { casos: ['CasosPendientes'] },
    });
    expect(d.items[0]?.bindingProblems[0]?.kind).toBe('campo-inexistente');
  });

  it('marca roto un objeto cuyo dataset no esta en el cache', () => {
    const d = validateModule({
      module: modulo([item('a', 'barras')]),
      registry: registro,
      columnsByDataset: {},
    });
    expect(d.items[0]?.broken).toBe(true);
    expect(d.items[0]?.bindingProblems[0]?.problem).toMatch(/no esta disponible en el cache/);
  });

  it('reporta ademas los problemas de disposicion', () => {
    const d = validateModule({
      module: modulo([
        item('a', 'barras', { x: 0, y: 0, w: 8, h: 2 }),
        item('b', 'tabla', { x: 4, y: 0, w: 8, h: 2 }),
      ]),
      registry: registro,
      columnsByDataset: gridColumns,
    });
    expect(d.layoutProblems.some((p) => p.kind === 'solapamiento')).toBe(true);
  });
});

describe('puerta de publicacion institucional', () => {
  it('un modulo sano no tiene bloqueos', () => {
    const d = validateModule({
      module: modulo([item('a', 'barras')]),
      registry: registro,
      columnsByDataset: gridColumns,
    });
    expect(findPublishBlockers(d)).toEqual([]);
  });

  it('un objeto roto bloquea la publicacion institucional', () => {
    const d = validateModule({
      module: modulo([item('a', 'barras')]),
      registry: registro,
      columnsByDataset: {},
    });
    expect(findPublishBlockers(d)[0]?.reason).toBe('objeto-roto');
  });

  it('un complemento colocado como objeto suelto bloquea la publicacion', () => {
    // La puerta no basta con existir: tiene que estar INVOCADA desde validateModule, o el
    // editor guardaria un modulo que no se puede dibujar. Esta prueba es la que lo comprueba.
    const suelto = item('a', 'tooltip-explicativo');
    const d = validateModule({
      module: modulo([suelto]),
      registry: registro,
      columnsByDataset: gridColumns,
    });

    expect(findPublishBlockers(d)[0]?.reason).toBe('objeto-roto');
    expect(findPublishBlockers(d)[0]?.detail).toMatch(/no puede colocarse como objeto independiente/);
  });

  it('un objeto con sus complementos bien configurados no bloquea nada', () => {
    const anfitrion = item('a', 'barras');
    anfitrion.instance.attachments = [
      { instanceId: 'a1', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Que es esto.' },
      { instanceId: 'a2', objectId: 'tabla-de-datos', version: '1.0.0', scope: 'subobjeto' },
    ];

    const d = validateModule({
      module: modulo([anfitrion]),
      registry: registro,
      columnsByDataset: gridColumns,
    });
    expect(findPublishBlockers(d)).toEqual([]);
  });

  it('una instancia en version vencida bloquea la publicacion', () => {
    const d = validateModule({
      module: modulo([item('a', 'barras')]),
      registry: registro,
      columnsByDataset: gridColumns,
    });
    expect(findPublishBlockers(d, ['a'])[0]?.reason).toBe('version-vencida');
  });
});

describe('personalizacion por usuario final (4.6)', () => {
  const base = modulo([item('a', 'barras'), item('b', 'tabla', { x: 6, y: 0, w: 6, h: 2 })]);

  it('sin personalizacion devuelve la vista institucional', () => {
    const r = applyPersonalization(base, undefined);
    expect(r.isPersonalized).toBe(false);
    expect(r.module).toBe(base);
  });

  it('oculta y reposiciona, sin mutar la definicion institucional', () => {
    const r = applyPersonalization(base, {
      userId: 'ana',
      moduleId: base.moduleId,
      hiddenItemIds: ['b'],
      positionOverrides: { a: { x: 0, y: 0, w: 12, h: 4 } },
      updatedAt: '2026-09-11T09:00:00.000Z',
    });
    expect(r.isPersonalized).toBe(true);
    expect(r.module.pages[0]?.items.map((i) => i.id)).toEqual(['a']);
    expect(r.module.pages[0]?.items[0]?.position.w).toBe(12);
    // La institucional sigue intacta: cualquiera puede volver a ella.
    expect(base.pages[0]?.items).toHaveLength(2);
    expect(base.pages[0]?.items[0]?.position.w).toBe(6);
  });

  it('NUNCA altera la logica de calculo: el binding se copia tal cual', () => {
    const r = applyPersonalization(base, {
      userId: 'ana',
      moduleId: base.moduleId,
      hiddenItemIds: [],
      positionOverrides: { a: { x: 0, y: 0, w: 12, h: 4 } },
      updatedAt: '2026-09-11T09:00:00.000Z',
    });
    expect(r.module.pages[0]?.items[0]?.instance.binding).toEqual(
      base.pages[0]?.items[0]?.instance.binding,
    );
  });

  it('rechaza una personalizacion que llegue por red intentando tocar el calculo', () => {
    expect(() =>
      assertPersonalizationIsPresentationOnly({ hiddenItemIds: [], measures: ['OtraMedida'] }),
    ).toThrow(/nunca a la logica de calculo/);
    expect(() =>
      assertPersonalizationIsPresentationOnly({ hiddenItemIds: [], datasetId: 'otro' }),
    ).toThrow(/nunca a la logica de calculo/);
  });

  it('distingue la vista personalizada de la institucional, tambien al exportar', () => {
    expect(describeProvenance(true).label).toMatch(/no es la vista institucional oficial/);
    expect(describeProvenance(false).label).toMatch(/institucional oficial/);
  });
});

describe('utilidades de modulo', () => {
  it('construye la URL por slug, con pagina opcional (4.11)', () => {
    expect(moduleUrl({ slug: 'casos-pendientes' })).toBe('/m/casos-pendientes');
    expect(moduleUrl({ slug: 'casos-pendientes' }, { slug: 'detalle' })).toBe(
      '/m/casos-pendientes/detalle',
    );
  });

  it('lista los datasets que consume, para su contrato de modulo (3.3)', () => {
    const m = modulo([item('a', 'barras'), item('b', 'tabla')]);
    const segunda = m.pages[0]?.items[1];
    if (!segunda) throw new Error('fixture inesperado');
    segunda.instance = {
      ...segunda.instance,
      binding: { ...segunda.instance.binding, datasetId: 'audiencias' },
    };
    expect(datasetsConsumedBy(m)).toEqual(['audiencias', 'casos']);
  });

  it('resuelve la pagina por slug, con la primera como predeterminada', () => {
    const m = modulo([item('a', 'barras')]);
    expect(findPage(m)?.slug).toBe('general');
    expect(findPage(m, 'general')?.slug).toBe('general');
    expect(findPage(m, 'inexistente')).toBeUndefined();
  });
});
