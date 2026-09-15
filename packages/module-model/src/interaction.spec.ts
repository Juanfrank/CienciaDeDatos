import { describe, expect, it } from 'vitest';

import {
  INTERACTION_PATTERNS,
  bookmarkToUrl,
  captureBookmark,
  drillThroughUrl,
} from './interaction';

describe('catalogo de patrones de interaccion (4.4)', () => {
  it('declara los cuatro patrones soportados, de forma explicita y no arbitraria', () => {
    expect(INTERACTION_PATTERNS.map((p) => p.id).sort()).toEqual([
      'drill-through',
      'filtrado-cruzado',
      'marcador',
      'segmentador',
    ]);
  });

  it('los cuatro representan su estado en la URL, no en estado de componente', () => {
    // Es lo que hace que compartir, marcar y recargar salgan gratis (4.11).
    for (const pattern of INTERACTION_PATTERNS) {
      expect(pattern.stateRepresentation).toBe('query-string');
    }
  });

  it('cada patron documenta que impide que amplie el acceso', () => {
    for (const pattern of INTERACTION_PATTERNS) {
      expect(pattern.securityNote.trim().length).toBeGreaterThan(0);
    }
  });

  it('los ajustes incrementales usan replaceState y la navegacion pushState', () => {
    const id = new Map(INTERACTION_PATTERNS.map((p) => [p.id, p]));
    expect(id.get('segmentador')?.historyBehavior).toBe('replaceState');
    expect(id.get('filtrado-cruzado')?.historyBehavior).toBe('replaceState');
    expect(id.get('drill-through')?.historyBehavior).toBe('pushState');
  });
});

describe('marcadores: una URL con nombre, nada mas (4.4)', () => {
  const marcador = captureBookmark({
    id: 'm1',
    name: 'Penal en mi distrito',
    ownerUserId: 'ana',
    moduleSlug: 'casos-pendientes',
    searchParams: { 'DimTribunal.Materia': 'Penal', 'DimTribunal.Distrito': ['Distrito Norte'] },
    createdAt: '2026-09-11T09:00:00.000Z',
  });

  it('captura los filtros y los reconstruye como URL', () => {
    const url = bookmarkToUrl(marcador);
    expect(url).toContain('/m/casos-pendientes?');
    expect(url).toContain('DimTribunal.Materia=Penal');
    expect(url).toContain('Distrito+Norte');
  });

  it('guarda FILTROS, nunca datos ni el ambito de quien lo creo', () => {
    // Si guardara cualquiera de las dos cosas, un marcador compartido filtraria datos del
    // creador a quien lo abre.
    const serializado = JSON.stringify(marcador);
    expect(serializado).not.toContain('rows');
    expect(serializado).not.toContain('restrictions');
    expect(Object.keys(marcador).sort()).toEqual([
      'createdAt', 'filters', 'id', 'moduleSlug', 'name', 'ownerUserId',
    ]);
  });

  it('conserva los valores multiples de un mismo campo', () => {
    const m = captureBookmark({
      id: 'm2',
      name: 'Dos materias',
      ownerUserId: 'ana',
      moduleSlug: 'casos-pendientes',
      searchParams: new URLSearchParams([
        ['DimTribunal.Materia', 'Penal'],
        ['DimTribunal.Materia', 'Civil'],
      ]),
      createdAt: '2026-09-11T09:00:00.000Z',
    });
    expect(m.filters['DimTribunal.Materia']).toEqual(['Penal', 'Civil']);
  });

  it('un marcador sin filtros da la URL limpia del modulo', () => {
    expect(bookmarkToUrl({ moduleSlug: 'audiencias', filters: {} })).toBe('/m/audiencias');
  });

  it('incluye la pagina cuando el modulo tiene varias', () => {
    expect(bookmarkToUrl({ moduleSlug: 'casos', pageSlug: 'detalle', filters: {} })).toBe(
      '/m/casos/detalle',
    );
  });

});

describe('drill-through (4.4)', () => {
  const currentFilters = {
    'DimTribunal.Distrito': ['Distrito Norte'],
    'DimTribunal.Materia': ['Penal'],
  };

  it('lleva el contexto de filtros al modulo destino', () => {
    const url = drillThroughUrl({ moduleSlug: 'audiencias' }, currentFilters);
    expect(url).toContain('/m/audiencias?');
    expect(url).toContain('DimTribunal.Materia=Penal');
  });

  it('acota lo que lleva cuando el destino lo declara', () => {
    // Llevarlo todo suele arrastrar filtros sin sentido en el destino.
    const url = drillThroughUrl(
      { moduleSlug: 'audiencias', carryDimensions: ['DimTribunal.Materia'] },
      currentFilters,
    );
    expect(url).toContain('DimTribunal.Materia=Penal');
    expect(url).not.toContain('Distrito');
  });

  it('la seleccion viaja por los filtros, no por un canal aparte', () => {
    /*
     * El gesto «ver el detalle de ESTE valor» se hace pulsando la categoria, y eso ya escribe el
     * filtro en la URL. Habia un tercer parametro para decirlo otra vez, y dos sitios que dicen
     * lo mismo acaban diciendo cosas distintas: aqui se fija que el unico que queda es el estado
     * de filtros.
     */
    const url = drillThroughUrl({ moduleSlug: 'audiencias' }, {
      ...currentFilters,
      'DimTribunal.Materia': ['Civil'],
    });
    expect(url).toContain('DimTribunal.Materia=Civil');
    expect(url).not.toContain('Materia=Penal');
  });

  it('el contexto viaja como parametros de URL, para que el destino pueda intersecarlo', () => {
    // Que la interseccion con el ambito de quien LLEGA ocurra de verdad se prueba donde ambos
    // paquetes componen: apps/shell/src/server/marcadores.spec.ts y las pruebas de navegador.
    // Aqui solo se fija que el contexto sale en la URL y no en un canal aparte.
    const url = drillThroughUrl({ moduleSlug: 'audiencias' }, currentFilters);
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.getAll('DimTribunal.Distrito')).toEqual(['Distrito Norte']);
  });
});
