import { describe, expect, it } from 'vitest';
import { dimensionKey, gobiernoFixtures, intersectRequestedFilters } from '@app/access-control';
import { bookmarkToUrl, captureBookmark, drillThroughUrl } from '@app/module-model';

/**
 * Composicion de marcadores y drill-through con el ambito de acceso.
 *
 * Esta prueba vive en el shell y no en `packages/module-model` porque es justo aqui donde los
 * dos dominios se componen: module-model define QUE se captura y access-control decide QUE se
 * puede ver. Cada paquete se prueba solo por su lado; su interaccion se prueba donde ocurre.
 */
const { DIM_DISTRITO, scope } = gobiernoFixtures;

const marcadorDeAna = captureBookmark({
  id: 'm1',
  name: 'Mi distrito',
  ownerUserId: 'ana',
  moduleSlug: 'casos-pendientes',
  searchParams: { 'DimTribunal.Distrito': 'Distrito Norte' },
  createdAt: '2026-09-11T09:00:00.000Z',
});

describe('un marcador compartido se filtra segun QUIEN LO ABRE (criterio de la seccion 9)', () => {
  it('alguien de otro ambito no ve los datos del creador', () => {
    const ambitoDeBeto = scope(DIM_DISTRITO, 'Distrito Este');
    const efectivos = intersectRequestedFilters(ambitoDeBeto, marcadorDeAna.filters);
    // El marcador pedia el Norte; el ambito de Beto no lo permite.
    expect(efectivos[dimensionKey(DIM_DISTRITO)]).toEqual([]);
  });

  it('quien comparte el ambito si ve lo mismo', () => {
    const mismoAmbito = scope(DIM_DISTRITO, 'Distrito Norte');
    expect(intersectRequestedFilters(mismoAmbito, marcadorDeAna.filters)).toEqual({
      'DimTribunal.Distrito': ['Distrito Norte'],
    });
  });

  it('el marcador guarda filtros, no el ambito de quien lo creo', () => {
    // Si guardara el ambito, abrirlo desde otro equipo aplicaria el ambito ajeno.
    expect(JSON.stringify(marcadorDeAna)).not.toContain('restrictions');
    expect(bookmarkToUrl(marcadorDeAna)).toContain('Distrito+Norte');
  });
});

describe('drill-through intersecta con el ambito de quien LLEGA', () => {
  it('un destino fuera del ambito de quien llega no le muestra nada', () => {
    const url = drillThroughUrl(
      { moduleSlug: 'audiencias' },
      { 'DimTribunal.Distrito': ['Distrito Norte'] },
    );
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const pedidos: Record<string, string[]> = {};
    for (const clave of new Set(params.keys())) pedidos[clave] = params.getAll(clave);

    const ambitoDeQuienLlega = scope(DIM_DISTRITO, 'Distrito Este');
    expect(intersectRequestedFilters(ambitoDeQuienLlega, pedidos)[dimensionKey(DIM_DISTRITO)]).toEqual([]);
  });
});
