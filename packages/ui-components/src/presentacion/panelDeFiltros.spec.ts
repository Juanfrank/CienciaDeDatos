import { describe, expect, it } from 'vitest';
import type { ObjectInstance } from '../registry/types';
import {
  esTipoDeFecha,
  selectorPorDefecto,
  selectoresEfectivos,
  validarPanelDeFiltros,
} from './panelDeFiltros';

const instancia = (dimensiones: string[]): ObjectInstance => ({
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

const TIPOS = {
  'DimTribunal.Materia': 'string',
  'DimTribunal.Distrito': 'string',
  'DimTiempo.Fecha': 'date',
};

describe('validarPanelDeFiltros', () => {
  it('acepta un selector por cada dimension mapeada', () => {
    expect(
      validarPanelDeFiltros(
        instancia(['DimTribunal.Materia', 'DimTiempo.Fecha']),
        {
          selectores: [
            { campo: 'DimTribunal.Materia', tipo: 'pastillas' },
            { campo: 'DimTiempo.Fecha', tipo: 'rango-de-fechas' },
          ],
        },
        TIPOS,
      ),
    ).toEqual([]);
  });

  it('rechaza un selector sobre un campo que no esta mapeado', () => {
    const [problema] = validarPanelDeFiltros(
      instancia(['DimTribunal.Materia']),
      { selectores: [{ campo: 'DimTribunal.Distrito', tipo: 'pastillas' }] },
      TIPOS,
    );
    expect(problema?.campo).toBe('DimTribunal.Distrito');
    expect(problema?.problema).toContain('DimTribunal.Materia');
  });

  it('rechaza dos selectores para la misma dimension', () => {
    const problemas = validarPanelDeFiltros(
      instancia(['DimTribunal.Materia']),
      {
        selectores: [
          { campo: 'DimTribunal.Materia', tipo: 'pastillas' },
          { campo: 'DimTribunal.Materia', tipo: 'lista' },
        ],
      },
      TIPOS,
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0]?.problema).toContain('mas de un selector');
  });

  it('rechaza un calendario sobre una dimension que no es fecha', () => {
    // Es el motivo por el que el TIPO de columna viaja hasta la validacion: sin el, esto se
    // descubriria al dibujar, con un selector de fecha sobre valores «Penal» y «Civil».
    const [problema] = validarPanelDeFiltros(
      instancia(['DimTribunal.Materia']),
      { selectores: [{ campo: 'DimTribunal.Materia', tipo: 'calendario' }] },
      TIPOS,
    );
    expect(problema?.problema).toContain('necesita una dimension de fecha');
  });

  it('SE ABSTIENE si el tipo de la columna es desconocido', () => {
    // Un dataset que el job aun no ha poblado no tiene esquema, y entonces no se sabe el tipo de
    // nada. Rechazar ahi bloquearia configuraciones correctas en un despliegue recien hecho.
    expect(
      validarPanelDeFiltros(
        instancia(['DimTiempo.Fecha']),
        { selectores: [{ campo: 'DimTiempo.Fecha', tipo: 'calendario' }] },
        {},
      ),
    ).toEqual([]);
  });

  it('rechaza un tipo de selector inventado', () => {
    const [problema] = validarPanelDeFiltros(
      instancia(['DimTribunal.Materia']),
      { selectores: [{ campo: 'DimTribunal.Materia', tipo: 'rueda' as never }] },
      TIPOS,
    );
    expect(problema?.problema).toContain('no es un tipo de selector');
  });

  it('un panel sin configurar no tiene problemas', () => {
    expect(validarPanelDeFiltros(instancia(['DimTribunal.Materia']), undefined, TIPOS)).toEqual([]);
  });
});

describe('selectoresEfectivos', () => {
  it('da un selector a CADA dimension, aunque no este configurada', () => {
    // Lo importante de esta prueba: una dimension mapeada y no configurada seria una dimension
    // invisible, que es el peor fallo de un filtro — quien mira cree estar viendo el total.
    const efectivos = selectoresEfectivos(
      instancia(['DimTribunal.Materia', 'DimTiempo.Fecha']),
      { selectores: [{ campo: 'DimTribunal.Materia', tipo: 'desplegable' }] },
      TIPOS,
    );
    expect(efectivos.map((s) => [s.campo, s.tipo])).toEqual([
      ['DimTribunal.Materia', 'desplegable'],
      ['DimTiempo.Fecha', 'rango-de-fechas'],
    ]);
  });

  it('la etiqueta por defecto es el campo sin la tabla', () => {
    const [uno] = selectoresEfectivos(instancia(['DimTribunal.Materia']), undefined, TIPOS);
    expect(uno?.etiqueta).toBe('Materia');
  });

  it('respeta la etiqueta configurada', () => {
    const [uno] = selectoresEfectivos(
      instancia(['DimTribunal.Materia']),
      { selectores: [{ campo: 'DimTribunal.Materia', tipo: 'pastillas', etiqueta: 'Area' }] },
      TIPOS,
    );
    expect(uno?.etiqueta).toBe('Area');
  });

  it('mantiene el ORDEN del mapeo, no el de la configuracion', () => {
    // El orden en pantalla lo decide el binding, que es lo que el editor reordena. Si mandara el
    // de la configuracion, mover una dimension no cambiaria nada y nadie sabria por que.
    const efectivos = selectoresEfectivos(
      instancia(['DimTribunal.Materia', 'DimTribunal.Distrito']),
      {
        selectores: [
          { campo: 'DimTribunal.Distrito', tipo: 'lista' },
          { campo: 'DimTribunal.Materia', tipo: 'pastillas' },
        ],
      },
      TIPOS,
    );
    expect(efectivos.map((s) => s.campo)).toEqual([
      'DimTribunal.Materia',
      'DimTribunal.Distrito',
    ]);
  });
});

describe('selectorPorDefecto', () => {
  it('una fecha se filtra por rango; lo demas, por pastillas', () => {
    expect(selectorPorDefecto('date')).toBe('rango-de-fechas');
    expect(selectorPorDefecto('string')).toBe('pastillas');
  });

  it('reconoce como fecha los nombres que usa cada conector', () => {
    for (const tipo of ['date', 'DATETIME', 'timestamp', 'Fecha']) {
      expect(esTipoDeFecha(tipo), tipo).toBe(true);
    }
    expect(esTipoDeFecha('desconocido')).toBe(false);
  });
});
