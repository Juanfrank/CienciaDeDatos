import { describe, expect, it } from 'vitest';
import { catalogoInicial } from '../registry/catalog';
import { cabeEn, indiceDeInsercion, pozosPorDefecto, repartirEnPozos, type PozoDeCampos } from './pozos';

const POZOS: PozoDeCampos[] = [
  { id: 'x', etiqueta: 'Eje X', tipo: 'dimension', max: 1 },
  { id: 'serie', etiqueta: 'Serie', tipo: 'dimension', max: 1 },
];

describe('repartirEnPozos', () => {
  it('reparte en orden: el primer pozo se queda los primeros', () => {
    const { porPozo, sobrantes } = repartirEnPozos(['a', 'b'], POZOS);
    expect(porPozo.get('x')).toEqual(['a']);
    expect(porPozo.get('serie')).toEqual(['b']);
    expect(sobrantes).toEqual([]);
  });

  it('un pozo vacio si no hay suficientes campos', () => {
    const { porPozo } = repartirEnPozos(['a'], POZOS);
    expect(porPozo.get('x')).toEqual(['a']);
    expect(porPozo.get('serie')).toEqual([]);
  });

  it('lo que no cabe se devuelve APARTE, no se pierde', () => {
    // Puede pasar con un modulo guardado antes de que el objeto declarara pozos. Esconderlo
    // dejaria campos mapeados que el editor no muestra y nadie puede quitar.
    const { sobrantes } = repartirEnPozos(['a', 'b', 'c'], POZOS);
    expect(sobrantes).toEqual(['c']);
  });

  it('un pozo de varios se lleva su cupo entero', () => {
    const pozos: PozoDeCampos[] = [
      { id: 'y', etiqueta: 'Eje Y', tipo: 'medida', max: 4 },
      { id: 'tam', etiqueta: 'Tamano', tipo: 'medida', max: 1 },
    ];
    const { porPozo } = repartirEnPozos(['m1', 'm2', 'm3', 'm4', 'm5'], pozos);
    expect(porPozo.get('y')).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(porPozo.get('tam')).toEqual(['m5']);
  });
});

describe('indiceDeInsercion', () => {
  it('inserta al final de SU tramo, no del array', () => {
    // Insertar siempre al final pondria el campo en el pozo equivocado: se mapearia una serie y
    // apareceria en el eje.
    expect(indiceDeInsercion(['a', 'b'], POZOS, 'x')).toBe(1);
    expect(indiceDeInsercion(['a', 'b'], POZOS, 'serie')).toBe(2);
  });

  it('con el primer pozo vacio, el segundo empieza en cero', () => {
    expect(indiceDeInsercion([], POZOS, 'serie')).toBe(0);
  });
});

describe('cabeEn', () => {
  it('respeta el maximo de cada pozo', () => {
    expect(cabeEn([], POZOS, 'x')).toBe(true);
    expect(cabeEn(['a'], POZOS, 'x')).toBe(false);
    expect(cabeEn(['a'], POZOS, 'serie')).toBe(true);
  });

  it('un pozo que no existe no admite nada', () => {
    expect(cabeEn([], POZOS, 'inventado')).toBe(false);
  });
});

describe('pozosPorDefecto', () => {
  it('uno por tipo, con el rotulo generico', () => {
    const { dimensiones, medidas } = pozosPorDefecto({
      dimensions: { min: 1, max: 2 },
      measures: { min: 1, max: 4 },
    });
    expect(dimensiones.map((p) => [p.id, p.max])).toEqual([['dimensiones', 2]]);
    expect(medidas.map((p) => [p.id, p.max])).toEqual([['medidas', 4]]);
  });

  it('sin ranuras de un tipo, no hay pozo de ese tipo', () => {
    // Un segmentador no mapea medidas: ofrecerle un pozo de medidas vacio invita a preguntarse
    // que se pone ahi.
    const { medidas } = pozosPorDefecto({
      dimensions: { min: 1, max: 1 },
      measures: { min: 0, max: 0 },
    });
    expect(medidas).toEqual([]);
  });
});


describe('los pozos que declara el catalogo cuadran con su contrato', () => {
  const versiones = catalogoInicial.flatMap((o) =>
    o.versions.map((v) => ({ nombre: `${o.objectId}@${v.version}`, contrato: v.dataContract })),
  );

  it.each(versiones.map((v) => [v.nombre, v] as const))(
    '%s no promete mas ranuras de las que admite',
    (_n, { contrato }) => {
      const pozos = contrato.pozos ?? [];
      if (pozos.length === 0) return;

      /*
       * Un pozo que prometiera mas de lo que el objeto admite dejaria guardar un mapeo que la
       * validacion rechaza despues: el editor diria «caben cuatro» y al cuarto el objeto saldria
       * roto. Es el tipo de incoherencia que solo aparece cuando alguien la usa.
       */
      const cupo = (tipo: 'dimension' | 'medida') =>
        pozos.filter((p) => p.tipo === tipo).reduce((n, p) => n + p.max, 0);

      expect(cupo('dimension')).toBe(contrato.dimensions.max);
      expect(cupo('medida')).toBe(contrato.measures.max);
    },
  );

  it('ningun pozo del catalogo se queda sin etiqueta ni con cupo cero', () => {
    for (const { nombre, contrato } of versiones) {
      for (const pozo of contrato.pozos ?? []) {
        expect(pozo.etiqueta.trim().length, `${nombre}/${pozo.id}`).toBeGreaterThan(0);
        expect(pozo.max, `${nombre}/${pozo.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('los ids de un objeto son distintos entre si', () => {
    // Dos pozos con el mismo id se pisarian en el reparto y uno de los dos no recibiria nada.
    for (const { nombre, contrato } of versiones) {
      const ids = (contrato.pozos ?? []).map((p) => p.id);
      expect(new Set(ids).size, nombre).toBe(ids.length);
    }
  });
});
