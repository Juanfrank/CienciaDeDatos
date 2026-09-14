import { describe, expect, it } from 'vitest';
import { defaultSize } from './defaultSize';
import { initialCatalog } from '../registry/catalog';

/** El tamano con el que cada objeto entra en la rejilla — seccion 4.2. */

const GRID_COLUMNS = 12;
/** La forma reducida con la que trabaja la paleta del editor. */
const comoLaPaleta = (objeto: (typeof initialCatalog)[number]) => {
  const contrato = objeto.versions[objeto.versions.length - 1]!.dataContract;
  return {
    objectId: objeto.objectId,
    category: objeto.category,
    dimensiones: contrato.dimensions,
    medidas: contrato.measures,
  };
};

const de = (objectId: string) =>
  defaultSize(comoLaPaleta(initialCatalog.find((o) => o.objectId === objectId)!));

describe('tamano por defecto', () => {
  it('todo objeto del catalogo propone un tamano que cabe', () => {
    // Recorre el catalogo entero, no una muestra: un objeto nuevo que proponga trece columnas
    // entraria recortado y nadie lo sabria hasta verlo en pantalla.
    for (const objeto of initialCatalog) {
      const { w, h } = defaultSize(comoLaPaleta(objeto));
      expect(w, objeto.objectId).toBeGreaterThanOrEqual(1);
      expect(w, objeto.objectId).toBeLessThanOrEqual(GRID_COLUMNS);
      expect(h, objeto.objectId).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(w) && Number.isInteger(h), objeto.objectId).toBe(true);
    }
  });

  it('una cifra es pequena y una tabla ocupa el ancho', () => {
    // Es la diferencia que motivo todo esto: las dos nacian 6x3.
    expect(de('tarjeta-kpi')).toEqual({ w: 3, h: 2 });
    expect(de('medidor')).toEqual({ w: 3, h: 2 });
    expect(de('tabla').w).toBe(GRID_COLUMNS);
    expect(de('matriz').w).toBe(GRID_COLUMNS);
  });

  it('lo que encabeza o separa cruza la pagina y es plano', () => {
    expect(de('titulo-de-seccion')).toEqual({ w: 12, h: 1 });
    expect(de('linea-divisoria')).toEqual({ w: 12, h: 1 });
  });

  it('una forma nace cuadrada', () => {
    const { w, h } = de('forma');
    expect(w).toBe(h);
  });

  it('mas medidas piden mas alto, porque cada una es una serie', () => {
    // `combinado` exige dos medidas; `embudo`, una.
    expect(de('combinado').h).toBeGreaterThan(de('embudo').h);
  });

  it('mas dimensiones piden mas ancho, porque cada una es mas categorias en el eje', () => {
    // `barras` exige una dimension y admite tres; `pastel`, exactamente una.
    expect(de('barras').w).toBeGreaterThanOrEqual(de('pastel').w);
  });

  it('un contenedor nace con sitio para su propia rejilla', () => {
    for (const objeto of initialCatalog.filter((o) => o.category === 'contenedor')) {
      const { w, h } = defaultSize(comoLaPaleta(objeto));
      expect(w * h, objeto.objectId).toBeGreaterThanOrEqual(16);
    }
  });
});
