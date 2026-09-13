import { describe, expect, it } from 'vitest';
import { catalogoInicial } from '../registry/catalog';
import type { ObjectInstance } from '../registry/types';
import {
  cabeEnRanura,
  campoDeRanura,
  conCampoEnRanura,
  ranurasDe,
  ranurasDelContrato,
  ranurasPorDefecto,
  sinCampoEnRanura,
  validarRanuras,
  type RanuraDeCampos,
} from './pozos';

const RANURAS: RanuraDeCampos[] = [
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
    const puesta = conCampoEnRanura(objectInstance(), RANURAS, 'eje-y', 'CasosPendientes');

    expect(campoDeRanura(puesta, RANURAS, 'eje-x')).toBeUndefined();
    expect(campoDeRanura(puesta, RANURAS, 'eje-y')).toBe('CasosPendientes');
    expect(puesta.binding.measures).toEqual(['CasosPendientes']);
    expect(puesta.binding.dimensions).toEqual([]);
  });

  it('SE PUEDE llenar solo la serie, con el eje X vacio', () => {
    const puesta = conCampoEnRanura(objectInstance(), RANURAS, 'serie', 'DimTribunal.Materia');

    expect(campoDeRanura(puesta, RANURAS, 'eje-x')).toBeUndefined();
    expect(campoDeRanura(puesta, RANURAS, 'serie')).toBe('DimTribunal.Materia');
    // Y el array derivado lleva UN campo: quien lo lea por posicion lo tomaria por el eje, que es
    // exactamente el motivo por el que los renderizadores preguntan por la ranura.
    expect(puesta.binding.dimensions).toHaveLength(1);
  });

  it('los arrays derivados salen en el ORDEN DE DECLARACION de las ranuras', () => {
    // Es lo que hace que dos modulos con los mismos campos en las mismas ranuras produzcan la
    // misma consulta, y por tanto la misma clave de cache.
    let i = objectInstance();
    i = conCampoEnRanura(i, RANURAS, 'serie', 'DimTribunal.Materia');
    i = conCampoEnRanura(i, RANURAS, 'eje-x', 'DimTribunal.Distrito');

    expect(i.binding.dimensions.map((d) => `${d.table}.${d.field}`)).toEqual([
      'DimTribunal.Distrito',
      'DimTribunal.Materia',
    ]);
  });

  it('no admite mas de lo que la ranura declara, ni el mismo campo dos veces', () => {
    let i = conCampoEnRanura(objectInstance(), RANURAS, 'eje-x', 'A');
    i = conCampoEnRanura(i, RANURAS, 'eje-x', 'B');
    expect(ranurasDe(i, RANURAS).get('eje-x')).toEqual(['A']);

    const repetida = conCampoEnRanura(i, RANURAS, 'eje-x', 'A');
    expect(ranurasDe(repetida, RANURAS).get('eje-x')).toEqual(['A']);
  });

  it('quitar afecta a UNA ranura, no a todas', () => {
    // El mismo campo puede estar en dos ranuras; quitarlo de una no debe vaciar la otra.
    let i = conCampoEnRanura(objectInstance(), RANURAS, 'eje-x', 'DimTiempo.Fecha');
    i = conCampoEnRanura(i, RANURAS, 'serie', 'DimTiempo.Fecha');

    const sin = sinCampoEnRanura(i, RANURAS, 'eje-x', 'DimTiempo.Fecha');
    expect(campoDeRanura(sin, RANURAS, 'eje-x')).toBeUndefined();
    expect(campoDeRanura(sin, RANURAS, 'serie')).toBe('DimTiempo.Fecha');
  });

  it('cabeEnRanura respeta el cupo de cada una', () => {
    const i = conCampoEnRanura(objectInstance(), RANURAS, 'eje-x', 'A');
    expect(cabeEnRanura(i, RANURAS, 'eje-x')).toBe(false);
    expect(cabeEnRanura(i, RANURAS, 'eje-y')).toBe(true);
    expect(cabeEnRanura(i, RANURAS, 'inventada')).toBe(false);
  });
});

describe('compatibilidad con lo guardado antes', () => {
  it('una instancia SIN mapa de ranuras se interpreta por orden', () => {
    /*
     * Todo lo guardado antes de este cambio. Sin esta deduccion, cada modulo existente apareceria
     * con las ranuras vacias y sus campos perdidos de vista.
     */
    const antigua = objectInstance({
      dimensions: [
        { table: 'DimTribunal', field: 'Distrito' },
        { table: 'DimTribunal', field: 'Materia' },
      ],
      measures: ['CasosPendientes'],
    });

    expect(campoDeRanura(antigua, RANURAS, 'eje-x')).toBe('DimTribunal.Distrito');
    expect(campoDeRanura(antigua, RANURAS, 'serie')).toBe('DimTribunal.Materia');
    expect(ranurasDe(antigua, RANURAS).get('eje-y')).toEqual(['CasosPendientes']);
  });

  it('el primer cambio sobre una instancia antigua la deja ya con mapa', () => {
    const antigua = objectInstance({
      dimensions: [{ table: 'DimTribunal', field: 'Distrito' }],
      measures: [],
    });
    const puesta = conCampoEnRanura(antigua, RANURAS, 'eje-y', 'CasosPendientes');

    expect(puesta.binding.ranuras).toEqual({
      'eje-x': ['DimTribunal.Distrito'],
      serie: [],
      'eje-y': ['CasosPendientes'],
    });
  });

  it('una asignacion guardada con mas campos de los que caben se recorta, no desborda', () => {
    // Pasa al bajar el cupo de una ranura entre versiones del objeto.
    const i = objectInstance({ ranuras: { 'eje-x': ['A', 'B'] } });
    expect(ranurasDe(i, RANURAS).get('eje-x')).toEqual(['A']);
  });

  it('con DOS ranuras obligatorias del mismo tipo, el reparto respeta los minimos', () => {
    /*
     * En una sola pasada, «Columnas» se llevaba las tres medidas y «Lineas» se quedaba vacia: un
     * combinado sin asignacion guardada salia SIEMPRE roto, aunque el mapeo trajera medidas de
     * sobra. El valor por omision tiene que cumplir el contrato cuando hay campos suficientes.
     */
    const dosPozos: RanuraDeCampos[] = [
      { id: 'columnas', etiqueta: 'Columnas', tipo: 'medida', max: 3, min: 1 },
      { id: 'lineas', etiqueta: 'Lineas', tipo: 'medida', max: 3, min: 1 },
    ];
    const i = objectInstance({ measures: ['A', 'B', 'C'] });
    const reparto = ranurasDe(i, dosPozos);

    expect(reparto.get('columnas')).toEqual(['A', 'C']);
    expect(reparto.get('lineas')).toEqual(['B']);
    expect(validarRanuras(i, dosPozos)).toEqual([]);
  });

  it('y con campos justos para los minimos, los reparte uno a cada una', () => {
    const dosPozos: RanuraDeCampos[] = [
      { id: 'columnas', etiqueta: 'Columnas', tipo: 'medida', max: 3, min: 1 },
      { id: 'lineas', etiqueta: 'Lineas', tipo: 'medida', max: 3, min: 1 },
    ];
    const reparto = ranurasDe(objectInstance({ measures: ['A', 'B'] }), dosPozos);
    expect(reparto.get('columnas')).toEqual(['A']);
    expect(reparto.get('lineas')).toEqual(['B']);
  });
});

describe('validarRanuras', () => {
  it('acepta una asignacion completa', () => {
    let i = conCampoEnRanura(objectInstance(), RANURAS, 'eje-x', 'D');
    i = conCampoEnRanura(i, RANURAS, 'eje-y', 'M');
    expect(validarRanuras(i, RANURAS)).toEqual([]);
  });

  it('rechaza un eje X vacio aunque el contrato global se cumpla', () => {
    /*
     * El punto de todo esto. «Entre 1 y 2 dimensiones» se cumple igual con la dimension en la
     * serie, y ese grafico no se puede dibujar. Solo la ranura sabe cual de sus campos hace falta.
     */
    let i = conCampoEnRanura(objectInstance(), RANURAS, 'serie', 'DimTribunal.Materia');
    i = conCampoEnRanura(i, RANURAS, 'eje-y', 'M');

    const problems = validarRanuras(i, RANURAS);
    expect(problems.map((p) => p.ranura)).toEqual(['eje-x']);
    expect(problems[0]?.issue).toContain('Eje X');
  });

  it('avisa de campos asignados a una ranura que el objeto ya no tiene', () => {
    // Pasa al cambiar de version: sin el aviso, quedarian mapeados sin que el editor los muestre
    // ni nadie pueda quitarlos.
    const i = objectInstance({
      ranuras: { 'eje-x': ['D'], 'eje-y': ['M'], 'ranura-vieja': ['Z'] },
    });
    const problems = validarRanuras(i, RANURAS);
    expect(problems.map((p) => p.ranura)).toContain('ranura-vieja');
  });

  it('sin ranuras declaradas no se valida nada', () => {
    expect(validarRanuras(objectInstance(), [])).toEqual([]);
  });
});

describe('ranurasPorDefecto', () => {
  it('una por tipo, con el cupo del contrato', () => {
    const ranuras = ranurasPorDefecto({
      dimensions: { min: 1, max: 2 },
      measures: { min: 1, max: 4 },
    });
    expect(ranuras.map((r) => [r.id, r.min, r.max])).toEqual([
      ['dimensiones', 1, 2],
      ['medidas', 1, 4],
    ]);
  });

  it('sin ranuras de un tipo, no hay ranura de ese tipo', () => {
    // Un segmentador no mapea medidas: ofrecerle una ranura de medidas vacia invita a preguntarse
    // que se pone ahi.
    const ranuras = ranurasPorDefecto({
      dimensions: { min: 1, max: 1 },
      measures: { min: 0, max: 0 },
    });
    expect(ranuras.map((r) => r.tipo)).toEqual(['dimension']);
  });
});

describe('las ranuras que declara el catalogo cuadran con su contrato', () => {
  const versiones = catalogoInicial.flatMap((o) =>
    o.versions.map((v) => ({ nombre: `${o.objectId}@${v.version}`, contrato: v.dataContract })),
  );

  it.each(versiones.map((v) => [v.nombre, v] as const))(
    '%s no promete mas ranuras de las que admite',
    (_n, { contrato }) => {
      const ranuras = contrato.pozos ?? [];
      if (ranuras.length === 0) return;

      const cupo = (tipo: 'dimension' | 'medida') =>
        ranuras.filter((r) => r.tipo === tipo).reduce((n, r) => n + r.max, 0);

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
      const ranuras = contrato.pozos ?? [];
      if (ranuras.length === 0) return;

      const minimo = (tipo: 'dimension' | 'medida') =>
        ranuras.filter((r) => r.tipo === tipo).reduce((n, r) => n + (r.min ?? 0), 0);

      expect(minimo('dimension')).toBeGreaterThanOrEqual(contrato.dimensions.min);
      expect(minimo('medida')).toBeGreaterThanOrEqual(contrato.measures.min);
    },
  );

  it('ninguna se queda sin etiqueta ni con cupo cero, y sus ids son distintos', () => {
    for (const { nombre, contrato } of versiones) {
      const ids = (contrato.pozos ?? []).map((r) => r.id);
      expect(new Set(ids).size, nombre).toBe(ids.length);
      for (const ranura of contrato.pozos ?? []) {
        expect(ranura.etiqueta.trim().length, `${nombre}/${ranura.id}`).toBeGreaterThan(0);
        expect(ranura.max, `${nombre}/${ranura.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('ranurasDelContrato cae a las genericas si el objeto no declara', () => {
    expect(
      ranurasDelContrato({ dimensions: { min: 1, max: 1 }, measures: { min: 0, max: 0 } }).map(
        (r) => r.id,
      ),
    ).toEqual(['dimensiones']);
  });
});
