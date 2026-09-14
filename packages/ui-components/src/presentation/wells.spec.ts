import { describe, expect, it } from 'vitest';
import { initialCatalog } from '../registry/catalog';
import type { ObjectInstance } from '../registry/types';
import {
  slotFits,
  slotField,
  withSlotField,
  slotsOf,
  contractSlots,
  defaultSlots,
  slotFieldWithout,
  validateSlots,
  type FieldSlot,
} from './wells';

const SLOTS: FieldSlot[] = [
  { id: 'eje-x', etiqueta: 'Eje X', tipo: 'dimension', max: 1, min: 1 },
  { id: 'serie', etiqueta: 'Serie', tipo: 'dimension', max: 1 },
  { id: 'eje-y', etiqueta: 'Eje Y', tipo: 'medida', max: 4, min: 1 },
];

const objectInstance = (binding: Partial<ObjectInstance['binding']> = {}): ObjectInstance => ({
  instanceId: 'i1',
  objectId: 'barras',
  version: '1.1.0',
  binding: { datasetId: 'd', dimensions: [], measures: [], ...binding },
});

describe('la ranura manda, no el orden', () => {
  it('SE PUEDE llenar el eje Y sin llenar el eje X', () => {
    /*
     * Es el caso que el reparto posicional no podia expresar: el primer campo caia siempre en la
     * primera ranura. Aqui el eje X se queda vacio y la medida va a su sitio.
     */
    const setup = withSlotField(objectInstance(), SLOTS, 'eje-y', 'CasosPendientes');

    expect(slotField(setup, SLOTS, 'eje-x')).toBeUndefined();
    expect(slotField(setup, SLOTS, 'eje-y')).toBe('CasosPendientes');
    expect(setup.binding.measures).toEqual(['CasosPendientes']);
    expect(setup.binding.dimensions).toEqual([]);
  });

  it('SE PUEDE llenar solo la serie, con el eje X vacio', () => {
    const setup = withSlotField(objectInstance(), SLOTS, 'serie', 'DimTribunal.Materia');

    expect(slotField(setup, SLOTS, 'eje-x')).toBeUndefined();
    expect(slotField(setup, SLOTS, 'serie')).toBe('DimTribunal.Materia');
    // Y el array derivado lleva UN campo: quien lo lea por posicion lo tomaria por el eje, que es
    // exactamente el motivo por el que los renderizadores preguntan por la ranura.
    expect(setup.binding.dimensions).toHaveLength(1);
  });

  it('los arrays derivados salen en el ORDEN DE DECLARACION de las ranuras', () => {
    // Es lo que hace que dos modulos con los mismos campos en las mismas ranuras produzcan la
    // misma consulta, y por tanto la misma clave de cache.
    let i = objectInstance();
    i = withSlotField(i, SLOTS, 'serie', 'DimTribunal.Materia');
    i = withSlotField(i, SLOTS, 'eje-x', 'DimTribunal.Distrito');

    expect(i.binding.dimensions.map((d) => `${d.table}.${d.field}`)).toEqual([
      'DimTribunal.Distrito',
      'DimTribunal.Materia',
    ]);
  });

  it('no admite mas de lo que la ranura declara, ni el mismo campo dos veces', () => {
    let i = withSlotField(objectInstance(), SLOTS, 'eje-x', 'A');
    i = withSlotField(i, SLOTS, 'eje-x', 'B');
    expect(slotsOf(i, SLOTS).get('eje-x')).toEqual(['A']);

    const repetida = withSlotField(i, SLOTS, 'eje-x', 'A');
    expect(slotsOf(repetida, SLOTS).get('eje-x')).toEqual(['A']);
  });

  it('quitar afecta a UNA ranura, no a todas', () => {
    // El mismo campo puede estar en dos ranuras; quitarlo de una no debe vaciar la otra.
    let i = withSlotField(objectInstance(), SLOTS, 'eje-x', 'DimTiempo.Fecha');
    i = withSlotField(i, SLOTS, 'serie', 'DimTiempo.Fecha');

    const sin = slotFieldWithout(i, SLOTS, 'eje-x', 'DimTiempo.Fecha');
    expect(slotField(sin, SLOTS, 'eje-x')).toBeUndefined();
    expect(slotField(sin, SLOTS, 'serie')).toBe('DimTiempo.Fecha');
  });

  it('slotFits respeta el cupo de cada una', () => {
    const i = withSlotField(objectInstance(), SLOTS, 'eje-x', 'A');
    expect(slotFits(i, SLOTS, 'eje-x')).toBe(false);
    expect(slotFits(i, SLOTS, 'eje-y')).toBe(true);
    expect(slotFits(i, SLOTS, 'inventada')).toBe(false);
  });
});

describe('compatibilidad con lo guardado antes', () => {
  it('una instancia SIN mapa de ranuras se interpreta por orden', () => {
    /*
     * Todo lo guardado antes de este cambio. Sin esta deduccion, cada modulo existente apareceria
     * con las ranuras vacias y sus campos perdidos de vista.
     */
    const old = objectInstance({
      dimensions: [
        { table: 'DimTribunal', field: 'Distrito' },
        { table: 'DimTribunal', field: 'Materia' },
      ],
      measures: ['CasosPendientes'],
    });

    expect(slotField(old, SLOTS, 'eje-x')).toBe('DimTribunal.Distrito');
    expect(slotField(old, SLOTS, 'serie')).toBe('DimTribunal.Materia');
    expect(slotsOf(old, SLOTS).get('eje-y')).toEqual(['CasosPendientes']);
  });

  it('el primer cambio sobre una instancia antigua la deja ya con mapa', () => {
    const old = objectInstance({
      dimensions: [{ table: 'DimTribunal', field: 'Distrito' }],
      measures: [],
    });
    const setup = withSlotField(old, SLOTS, 'eje-y', 'CasosPendientes');

    expect(setup.binding.slots).toEqual({
      'eje-x': ['DimTribunal.Distrito'],
      serie: [],
      'eje-y': ['CasosPendientes'],
    });
  });

  it('una asignacion guardada con mas campos de los que caben se recorta, no desborda', () => {
    // Pasa al bajar el cupo de una ranura entre versiones del objeto.
    const i = objectInstance({ slots: { 'eje-x': ['A', 'B'] } });
    expect(slotsOf(i, SLOTS).get('eje-x')).toEqual(['A']);
  });

  it('con DOS ranuras obligatorias del mismo tipo, el reparto respeta los minimos', () => {
    /*
     * En una sola pasada, «Columnas» se llevaba las tres medidas y «Lineas» se quedaba vacia: un
     * combinado sin asignacion guardada salia SIEMPRE roto, aunque el mapeo trajera medidas de
     * sobra. El valor por omision tiene que cumplir el contrato cuando hay campos suficientes.
     */
    const wellTwo: FieldSlot[] = [
      { id: 'columnas', etiqueta: 'Columnas', tipo: 'medida', max: 3, min: 1 },
      { id: 'lineas', etiqueta: 'Lineas', tipo: 'medida', max: 3, min: 1 },
    ];
    const i = objectInstance({ measures: ['A', 'B', 'C'] });
    const reparto = slotsOf(i, wellTwo);

    expect(reparto.get('columnas')).toEqual(['A', 'C']);
    expect(reparto.get('lineas')).toEqual(['B']);
    expect(validateSlots(i, wellTwo)).toEqual([]);
  });

  it('y con campos justos para los minimos, los reparte uno a cada una', () => {
    const wellTwo: FieldSlot[] = [
      { id: 'columnas', etiqueta: 'Columnas', tipo: 'medida', max: 3, min: 1 },
      { id: 'lineas', etiqueta: 'Lineas', tipo: 'medida', max: 3, min: 1 },
    ];
    const reparto = slotsOf(objectInstance({ measures: ['A', 'B'] }), wellTwo);
    expect(reparto.get('columnas')).toEqual(['A']);
    expect(reparto.get('lineas')).toEqual(['B']);
  });
});

describe('validateSlots', () => {
  it('acepta una asignacion completa', () => {
    let i = withSlotField(objectInstance(), SLOTS, 'eje-x', 'D');
    i = withSlotField(i, SLOTS, 'eje-y', 'M');
    expect(validateSlots(i, SLOTS)).toEqual([]);
  });

  it('rechaza un eje X vacio aunque el contrato global se cumpla', () => {
    /*
     * El punto de todo esto. «Entre 1 y 2 dimensiones» se cumple igual con la dimension en la
     * serie, y ese grafico no se puede dibujar. Solo la ranura sabe cual de sus campos hace falta.
     */
    let i = withSlotField(objectInstance(), SLOTS, 'serie', 'DimTribunal.Materia');
    i = withSlotField(i, SLOTS, 'eje-y', 'M');

    const problems = validateSlots(i, SLOTS);
    expect(problems.map((p) => p.ranura)).toEqual(['eje-x']);
    expect(problems[0]?.issue).toContain('Eje X');
  });

  it('avisa de campos asignados a una ranura que el objeto ya no tiene', () => {
    // Pasa al cambiar de version: sin el aviso, quedarian mapeados sin que el editor los muestre
    // ni nadie pueda quitarlos.
    const i = objectInstance({
      slots: { 'eje-x': ['D'], 'eje-y': ['M'], 'ranura-vieja': ['Z'] },
    });
    const problems = validateSlots(i, SLOTS);
    expect(problems.map((p) => p.ranura)).toContain('ranura-vieja');
  });

  it('sin ranuras declaradas no se valida nada', () => {
    expect(validateSlots(objectInstance(), [])).toEqual([]);
  });
});

describe('defaultSlots', () => {
  it('una por tipo, con el cupo del contrato', () => {
    const slots = defaultSlots({
      dimensions: { min: 1, max: 2 },
      measures: { min: 1, max: 4 },
    });
    expect(slots.map((r) => [r.id, r.min, r.max])).toEqual([
      ['dimensiones', 1, 2],
      ['medidas', 1, 4],
    ]);
  });

  it('sin ranuras de un tipo, no hay ranura de ese tipo', () => {
    // Un segmentador no mapea medidas: ofrecerle una ranura de medidas vacia invita a preguntarse
    // que se pone ahi.
    const slots = defaultSlots({
      dimensions: { min: 1, max: 1 },
      measures: { min: 0, max: 0 },
    });
    expect(slots.map((r) => r.tipo)).toEqual(['dimension']);
  });
});

describe('las ranuras que declara el catalogo cuadran con su contrato', () => {
  const versiones = initialCatalog.flatMap((o) =>
    o.versions.map((v) => ({ nombre: `${o.objectId}@${v.version}`, contrato: v.dataContract })),
  );

  it.each(versiones.map((v) => [v.nombre, v] as const))(
    '%s no promete mas ranuras de las que admite',
    (_n, { contrato }) => {
      const slots = contrato.wells ?? [];
      if (slots.length === 0) return;

      const cupo = (tipo: 'dimension' | 'medida') =>
        slots.filter((r) => r.tipo === tipo).reduce((n, r) => n + r.max, 0);

      expect(cupo('dimension')).toBe(contrato.dimensions.max);
      expect(cupo('medida')).toBe(contrato.measures.max);
    },
  );

  it.each(versiones.map((v) => [v.nombre, v] as const))(
    '%s pide al menos tantos campos como su contrato',
    (_n, { contrato }) => {
      /*
       * Los minimos por ranura tienen que sumar AL MENOS el minimo global: si sumaran menos, una
       * asignacion valida por ranura incumpliria el contrato y el objeto saldria roto sin que el
       * editor hubiera avisado de nada.
       */
      const slots = contrato.wells ?? [];
      if (slots.length === 0) return;

      const minimo = (tipo: 'dimension' | 'medida') =>
        slots.filter((r) => r.tipo === tipo).reduce((n, r) => n + (r.min ?? 0), 0);

      expect(minimo('dimension')).toBeGreaterThanOrEqual(contrato.dimensions.min);
      expect(minimo('medida')).toBeGreaterThanOrEqual(contrato.measures.min);
    },
  );

  it('ninguna se queda sin etiqueta ni con cupo cero, y sus ids son distintos', () => {
    for (const { nombre, contrato } of versiones) {
      const ids = (contrato.wells ?? []).map((r) => r.id);
      expect(new Set(ids).size, nombre).toBe(ids.length);
      for (const ranura of contrato.wells ?? []) {
        expect(ranura.etiqueta.trim().length, `${nombre}/${ranura.id}`).toBeGreaterThan(0);
        expect(ranura.max, `${nombre}/${ranura.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('contractSlots cae a las genericas si el objeto no declara', () => {
    expect(
      contractSlots({ dimensions: { min: 1, max: 1 }, measures: { min: 0, max: 0 } }).map(
        (r) => r.id,
      ),
    ).toEqual(['dimensiones']);
  });
});
