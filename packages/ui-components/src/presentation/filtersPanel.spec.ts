import { describe, expect, it } from 'vitest';
import type { ObjectInstance } from '../registry/types';
import {
  dateKindIs,
  defaultPicker,
  selectoresEfectivos,
  validatePanelFilters,
} from './filtersPanel';

const objectInstance = (dimensiones: string[]): ObjectInstance => ({
  instanceId: 'f1',
  objectId: 'panel-de-filtros',
  version: '1.0.0',
  binding: {
    datasetId: 'd',
    dimensions: dimensiones.map((clave) => {
      const [table, ...resto] = clave.split('.');
      return { table: table ?? '', field: resto.join('.') };
    }),
    measures: [],
  },
});

const KINDS = {
  'DimTribunal.Materia': 'string',
  'DimTribunal.Distrito': 'string',
  'DimTiempo.Fecha': 'date',
};

describe('validatePanelFilters', () => {
  it('acepta un selector por cada dimension mapeada', () => {
    expect(
      validatePanelFilters(
        objectInstance(['DimTribunal.Materia', 'DimTiempo.Fecha']),
        {
          pickers: [
            { fieldName: 'DimTribunal.Materia', tipo: 'pastillas' },
            { fieldName: 'DimTiempo.Fecha', tipo: 'rango-de-fechas' },
          ],
        },
        KINDS,
      ),
    ).toEqual([]);
  });

  it('rechaza un selector sobre un campo que no esta mapeado', () => {
    const [issue] = validatePanelFilters(
      objectInstance(['DimTribunal.Materia']),
      { pickers: [{ fieldName: 'DimTribunal.Distrito', tipo: 'pastillas' }] },
      KINDS,
    );
    expect(issue?.fieldName).toBe('DimTribunal.Distrito');
    expect(issue?.issue).toContain('DimTribunal.Materia');
  });

  it('rechaza dos selectores para la misma dimension', () => {
    const problems = validatePanelFilters(
      objectInstance(['DimTribunal.Materia']),
      {
        pickers: [
          { fieldName: 'DimTribunal.Materia', tipo: 'pastillas' },
          { fieldName: 'DimTribunal.Materia', tipo: 'lista' },
        ],
      },
      KINDS,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.issue).toContain('mas de un selector');
  });

  it('rechaza un calendario sobre una dimension que no es fecha', () => {
    // Es el motivo por el que el TIPO de columna viaja hasta la validacion: sin el, esto se
    // descubriria al dibujar, con un selector de fecha sobre valores «Penal» y «Civil».
    const [issue] = validatePanelFilters(
      objectInstance(['DimTribunal.Materia']),
      { pickers: [{ fieldName: 'DimTribunal.Materia', tipo: 'calendario' }] },
      KINDS,
    );
    expect(issue?.issue).toContain('necesita una dimension de fecha');
  });

  it('SE ABSTIENE si el tipo de la columna es desconocido', () => {
    // Un dataset que el job aun no ha poblado no tiene esquema, y entonces no se sabe el tipo de
    // nada. Rechazar ahi bloquearia configuraciones correctas en un despliegue recien hecho.
    expect(
      validatePanelFilters(
        objectInstance(['DimTiempo.Fecha']),
        { pickers: [{ fieldName: 'DimTiempo.Fecha', tipo: 'calendario' }] },
        {},
      ),
    ).toEqual([]);
  });

  it('rechaza un tipo de selector inventado', () => {
    const [issue] = validatePanelFilters(
      objectInstance(['DimTribunal.Materia']),
      { pickers: [{ fieldName: 'DimTribunal.Materia', tipo: 'rueda' as never }] },
      KINDS,
    );
    expect(issue?.issue).toContain('no es un tipo de selector');
  });

  it('un panel sin configurar no tiene problemas', () => {
    expect(validatePanelFilters(objectInstance(['DimTribunal.Materia']), undefined, KINDS)).toEqual([]);
  });
});

describe('selectoresEfectivos', () => {
  it('da un selector a CADA dimension, aunque no este configurada', () => {
    // Lo importante de esta prueba: una dimension mapeada y no configurada seria una dimension
    // invisible, que es el peor fallo de un filtro — quien mira cree estar viendo el total.
    const efectivos = selectoresEfectivos(
      objectInstance(['DimTribunal.Materia', 'DimTiempo.Fecha']),
      { pickers: [{ fieldName: 'DimTribunal.Materia', tipo: 'desplegable' }] },
      KINDS,
    );
    expect(efectivos.map((s) => [s.fieldName, s.tipo])).toEqual([
      ['DimTribunal.Materia', 'desplegable'],
      ['DimTiempo.Fecha', 'rango-de-fechas'],
    ]);
  });

  it('la etiqueta por defecto es el campo sin la tabla', () => {
    const [uno] = selectoresEfectivos(objectInstance(['DimTribunal.Materia']), undefined, KINDS);
    expect(uno?.etiqueta).toBe('Materia');
  });

  it('respeta la etiqueta configurada', () => {
    const [uno] = selectoresEfectivos(
      objectInstance(['DimTribunal.Materia']),
      { pickers: [{ fieldName: 'DimTribunal.Materia', tipo: 'pastillas', etiqueta: 'Area' }] },
      KINDS,
    );
    expect(uno?.etiqueta).toBe('Area');
  });

  it('mantiene el ORDEN del mapeo, no el de la configuracion', () => {
    // El orden en pantalla lo decide el binding, que es lo que el editor reordena. Si mandara el
    // de la configuracion, mover una dimension no cambiaria nada y nadie sabria por que.
    const efectivos = selectoresEfectivos(
      objectInstance(['DimTribunal.Materia', 'DimTribunal.Distrito']),
      {
        pickers: [
          { fieldName: 'DimTribunal.Distrito', tipo: 'lista' },
          { fieldName: 'DimTribunal.Materia', tipo: 'pastillas' },
        ],
      },
      KINDS,
    );
    expect(efectivos.map((s) => s.fieldName)).toEqual([
      'DimTribunal.Materia',
      'DimTribunal.Distrito',
    ]);
  });
});

describe('defaultPicker', () => {
  it('una fecha se filtra por rango; lo demas, por pastillas', () => {
    expect(defaultPicker('date')).toBe('rango-de-fechas');
    expect(defaultPicker('string')).toBe('pastillas');
  });

  it('reconoce como fecha los nombres que usa cada conector', () => {
    for (const tipo of ['date', 'DATETIME', 'timestamp', 'Fecha']) {
      expect(dateKindIs(tipo), tipo).toBe(true);
    }
    expect(dateKindIs('desconocido')).toBe(false);
  });
});
