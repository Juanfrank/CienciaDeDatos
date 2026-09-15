import { describe, expect, it } from 'vitest';
import type { QueryResult } from '@app/data-contracts';
import {
  applyVisualFilter,
  attachmentKeyIs,
  footerReferences,
  footerText,
  paginate,
  paginationLegend,
  paginationKey,
  visualFilterKey,
} from './attachmentView';
import type { ObjectInstance } from './types';

/**
 * Los tres complementos de vista, probados sobre datos y no sobre pantalla.
 *
 * Lo que se fija aqui es lo que no se ve mirando: que el paginado cuente CATEGORIAS y no filas de
 * origen, que el pie resuelva por orden de mapeo y sobre lo que el objeto tiene delante, y que el
 * filtro de visualizacion no se pise con el de otro objeto.
 */

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };

/** Un filtro que no pide nada: el punto de partida de cada caso. */
const SIN_PEDIR = { incluye: [] as string[], excluye: [] as string[] };

/**
 * Tres distritos en seis filas: cada distrito aparece dos veces.
 *
 * Es la forma que distingue las dos maneras de contar. Paginando de dos en dos por categoria son
 * dos paginas; contando filas de origen serian tres, y la ultima ensenaria media categoria.
 */
const result: QueryResult = {
  columns: [
    { name: 'DimTribunal.Distrito', type: 'texto' },
    { name: 'DimTiempo.Trimestre', type: 'texto' },
    { name: 'CasosPendientes', type: 'numero' },
  ],
  rows: [
    ['Este', 'T1', 10],
    ['Este', 'T2', 5],
    ['Norte', 'T1', 20],
    ['Norte', 'T2', 1],
    ['Sur', 'T1', 30],
    ['Sur', 'T2', 4],
  ],
  source: 'mock',
  generatedAt: '2026-09-14T00:00:00.000Z',
};

const instance: ObjectInstance = {
  instanceId: 'i1',
  objectId: 'barras',
  version: '1.0.0',
  binding: { datasetId: 'casos', dimensions: [DISTRITO], measures: ['CasosPendientes'] },
};

describe('las claves de la URL', () => {
  it('llevan el instanceId delante, para que dos objetos no se pisen', () => {
    // Es la razon de ser de la clave: filtrar una visual no puede mover la de al lado, aunque
    // las dos esten filtradas por la misma dimension.
    expect(visualFilterKey('i1')).not.toBe(visualFilterKey('i2'));
    expect(paginationKey('i1')).not.toBe(visualFilterKey('i1'));
  });

  it('se distinguen de una clave de campo, que es lo que la pagina si filtra', () => {
    // La linea de «filtros aplicados» del modulo se apoya en esto para no recitar el recorte de
    // una tarjeta como si acotara la pagina entera.
    expect(attachmentKeyIs(visualFilterKey('i1'))).toBe(true);
    expect(attachmentKeyIs(paginationKey('i1'))).toBe(true);
    expect(attachmentKeyIs('DimTribunal.Distrito')).toBe(false);
    expect(attachmentKeyIs('DimTiempo.Trimestre.desde')).toBe(false);
  });
});

describe('filtro de visualizacion', () => {
  it('sin seleccion no toca nada: no es un filtro que empiece filtrando', () => {
    expect(applyVisualFilter(result, 'DimTribunal.Distrito', SIN_PEDIR)).toBe(result);
  });

  it('deja solo las filas de los valores elegidos', () => {
    const filtrado = applyVisualFilter(result, 'DimTribunal.Distrito', {
      ...SIN_PEDIR,
      incluye: ['Norte'],
    });
    expect(filtrado.rows).toEqual([
      ['Norte', 'T1', 20],
      ['Norte', 'T2', 1],
    ]);
    // Y no toca las columnas: el objeto sigue mapeando lo mismo.
    expect(filtrado.columns).toEqual(result.columns);
  });

  it('un campo que no esta en el resultado no vacia el objeto', () => {
    // Vaciarlo diria «no hay datos» cuando lo que pasa es que la configuracion apunta a un campo
    // que ya no viene. El objeto se dibuja entero y la validacion es quien lo denuncia.
    expect(applyVisualFilter(result, 'NoExiste', { ...SIN_PEDIR, incluye: ['x'] }).rows).toHaveLength(6);
  });

  it('admite las MISMAS formas de acotar que el panel, no solo valores', () => {
    // Es lo que hace que acotar una visual sola y acotar la pagina entera comparen igual: las dos
    // pasan por `applyFilters`. Con una lista de valores, las otras cinco formas habrian
    // necesitado una segunda implementacion aqui.
    const excluido = applyVisualFilter(result, 'DimTribunal.Distrito', {
      ...SIN_PEDIR,
      excluye: ['Norte', 'Sur'],
    });
    expect(excluido.rows.map((f) => f[0])).toEqual(['Este', 'Este']);

    const rango = applyVisualFilter(result, 'CasosPendientes', { ...SIN_PEDIR, desde: '20' });
    expect(rango.rows).toHaveLength(2);
  });
});

describe('paginado', () => {
  it('cuenta CATEGORIAS, no filas de origen', () => {
    const { result: pagina, vista } = paginate(result, [DISTRITO], 2, 1);

    expect(vista.total).toBe(3);
    expect(vista.paginas).toBe(2);
    // Las dos primeras categorias enteras: cuatro filas de origen, no dos.
    expect(pagina.rows).toHaveLength(4);
    expect(pagina.rows.map((f) => f[0])).toEqual(['Este', 'Este', 'Norte', 'Norte']);
  });

  it('la ultima pagina lleva lo que queda, y la coletilla lo dice', () => {
    const { vista } = paginate(result, [DISTRITO], 2, 2);
    expect(vista).toMatchObject({ pagina: 2, paginas: 2, desde: 3, hasta: 3, total: 3 });
    expect(paginationLegend(vista)).toBe('Registros del 3 al 3. Total 3.');
  });

  it('una pagina fuera de rango se recorta en vez de dejar el objeto en blanco', () => {
    // La URL la escribe cualquiera. Un objeto vacio no dice «esa pagina no existe», dice «no hay
    // datos», que es una afirmacion sobre el expediente y no sobre la direccion.
    const { result: pagina, vista } = paginate(result, [DISTRITO], 2, 99);
    expect(vista.pagina).toBe(2);
    expect(pagina.rows.length).toBeGreaterThan(0);

    const antes = paginate(result, [DISTRITO], 2, -3);
    expect(antes.vista.pagina).toBe(1);
  });

  it('un tamano de pagina absurdo no divide por cero', () => {
    const { vista } = paginate(result, [DISTRITO], 0, 1);
    expect(vista.paginas).toBe(3);
    expect(Number.isFinite(vista.paginas)).toBe(true);
  });

  it('sin filas, una pagina vacia y una coletilla que lo dice', () => {
    const { vista } = paginate({ ...result, rows: [] }, [DISTRITO], 5, 1);
    expect(vista).toMatchObject({ total: 0, paginas: 1, desde: 0, hasta: 0 });
    expect(paginationLegend(vista)).toBe('Sin registros.');
  });
});

describe('pie de pagina', () => {
  it('lee las referencias en orden de aparicion', () => {
    expect(footerReferences('Total {{2}} sobre {{1}}.')).toEqual([2, 1]);
    expect(footerReferences('Sin cifras.')).toEqual([]);
  });

  it('sustituye por el total de la medida en esa POSICION de mapeo', () => {
    expect(footerText('Total: {{1}}.', instance, result, ['suma'])).toBe('Total: 70.');
  });

  it('la marca de agregacion solo aparece si el objeto AGREGO de verdad', () => {
    /*
     * El aviso lo estampaba el grafico de barras por su cuenta, y solo el: no se podia cambiar, no
     * se podia quitar, competia con este mismo complemento y los demas objetos agregaban igual y
     * se callaban. Como marca del pie, quien configura decide si aparece y con que alrededor.
     *
     * Y no puede mentir. `instance` mapea `DimTribunal.Distrito`, que tiene filas repetidas, asi
     * que agrega; con una dimension que no repita ninguna fila, la marca se va y no deja hueco.
     */
    expect(footerText('{{agregado}}', instance, result, ['suma'], undefined, 'Agregado.')).toBe(
      'Agregado.',
    );

    // Una fila por categoria: no hay nada que agregar, y el pie no lo dice.
    const unaPorCategoria = { ...result, rows: [result.rows[0] as unknown[]] };
    expect(
      footerText('{{agregado}}', instance, unaPorCategoria, ['suma'], undefined, 'Agregado.'),
    ).toBe('');
  });

  it('la marca convive con las referencias, y sin aviso no deja el hueco escrito', () => {
    // Un pie que solo llevara la marca no tiene ninguna referencia `{{n}}`: sin resolverla antes
    // del atajo de las referencias, la marca salia escrita tal cual en pantalla.
    expect(
      footerText('Total: {{1}}. {{agregado}}', instance, result, ['suma'], undefined, 'Agregado.'),
    ).toBe('Total: 70. Agregado.');
    expect(footerText('Total: {{1}}. {{agregado}}', instance, result, ['suma'])).toBe('Total: 70. ');
  });

  it('resuelve sobre lo que el objeto tiene delante, no sobre el dataset entero', () => {
    // Un pie bajo un objeto filtrado que dijera el total sin filtrar contradice a la visual que
    // acompaña, y quien lo lee no tiene forma de saber cual de las dos cifras vale.
    const filtrado = applyVisualFilter(result, 'DimTribunal.Distrito', {
      ...SIN_PEDIR,
      incluye: ['Norte'],
    });
    expect(footerText('Total: {{1}}.', instance, filtrado, ['suma'])).toBe('Total: 21.');
  });

  it('una referencia que no existe se deja tal cual, no se inventa una cifra', () => {
    expect(footerText('{{2}} casos', instance, result, ['suma'])).toBe('{{2}} casos');
  });

  it('un texto sin referencias se devuelve entero', () => {
    expect(footerText('Fuente: Poder Judicial.', instance, result, ['suma'])).toBe(
      'Fuente: Poder Judicial.',
    );
  });

  it('el formato de la cifra lo pone quien llama, no el pie', () => {
    // El pie no sabe de miles ni de porcentajes: si los decidiera aqui, la misma medida saldria
    // formateada de una manera en la visual y de otra dos lineas mas abajo.
    expect(
      footerText('Total: {{1}}.', instance, result, ['suma'], (_m, v) =>
        new Intl.NumberFormat('es-DO').format(v ?? 0),
      ),
    ).toBe('Total: 70.');
  });
});
