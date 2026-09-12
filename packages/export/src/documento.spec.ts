import { defaultTheme, temaClaro } from '@app/design-tokens';
import { describe, expect, it } from 'vitest';
import { construirDocumento } from './documento';
import { aSvg } from './formatos';
import type { ExportRequest, ExportableObject } from './types';

/**
 * El documento es lo que hace que los cuatro formatos no puedan divergir: QUE se exporta se
 * decide una sola vez, y cada formato solo decide COMO se dibuja.
 */

const peticion: ExportRequest = {
  moduleSlug: 'casos',
  moduleName: 'Casos pendientes',
  format: 'svg',
  requestedBy: 'ana',
  teamId: 'equipo-norte',
  provenance: { isPersonalized: false, label: 'Vista institucional oficial' },
  appliedFilters: {},
};

const objeto = (title: string, esGrafico: boolean, filas: unknown[][]): ExportableObject => ({
  title,
  esGrafico,
  result: {
    columns: [
      { name: 'categoria', type: 'string' },
      { name: 'valor', type: 'number' },
    ],
    rows: filas,
    source: 'mock',
    generatedAt: '2026-03-01T10:00:00.000Z',
  },
});

const kpi = objeto('Casos pendientes', false, [['Casos pendientes', 65]]);
const barras = objeto('Pendientes por distrito', true, [
  ['Norte', 35],
  ['Sur', 30],
]);

describe('construirDocumento', () => {
  it('lleva una hoja por objeto, en el mismo orden', () => {
    const documento = construirDocumento([kpi, barras], peticion);
    expect(documento.hojas.map((h) => h.title)).toEqual([
      'Casos pendientes',
      'Pendientes por distrito',
    ]);
  });

  it('elige como grafico el primer objeto MARCADO como grafico, no el primero a secas', () => {
    // Este es el arreglo: con la primera celda ocupada por una tarjeta KPI, la imagen exportada
    // era un grafico de barras de un solo numero, con la etiqueta repetida y sin significado.
    const documento = construirDocumento([kpi, barras], peticion);
    expect(documento.grafico?.title).toBe('Pendientes por distrito');
  });

  it('sin ningun grafico deja el campo vacio y el SVG cae en la primera hoja', () => {
    const documento = construirDocumento([kpi], peticion);
    expect(documento.grafico).toBeUndefined();

    // Mejor una imagen pobre que un archivo vacio; el encabezado dice de que objeto sale.
    expect(aSvg(documento)).toContain('Casos pendientes');
  });

  it('construye el encabezado una sola vez, para los cuatro formatos', () => {
    const documento = construirDocumento([barras], peticion);
    expect(documento.encabezado.titulo).toBe('Casos pendientes');
    expect(documento.encabezado.personalizada).toBe(false);
    expect(documento.encabezado.autor).toBe('ana');
  });

  it('marca la procedencia como dato, no solo como texto: Excel y PDF la destacan', () => {
    const documento = construirDocumento(
      [barras],
      { ...peticion, provenance: { isPersonalized: true, label: 'Vista personalizada de ana' } },
    );
    expect(documento.encabezado.personalizada).toBe(true);
  });
});

describe('aSvg sobre el documento', () => {
  it('dibuja una barra por fila del grafico elegido, con sus etiquetas reales', () => {
    const svg = aSvg(construirDocumento([kpi, barras], peticion));

    expect(svg.match(/<rect /g)?.length).toBe(3); // fondo + dos barras
    expect(svg).toContain('>Norte<');
    expect(svg).toContain('>Sur<');
    expect(svg).toContain('aria-label="Pendientes por distrito"');
  });

  it('un documento sin ninguna hoja no se dibuja a medias: falla y lo dice', () => {
    expect(() => aSvg(construirDocumento([], peticion))).toThrow(/dibujar/i);
  });
});

describe('la marca institucional llega al archivo exportado', () => {
  it('las series del documento son las del tema, no una paleta propia del exportador', () => {
    // Era el hueco: los cuatro generadores tenian sus colores escritos a mano, asi que un PDF
    // que circula por correo salia con otra paleta que la pantalla.
    const documento = construirDocumento([barras], peticion);
    expect(documento.paleta.series).toEqual(defaultTheme.color.categorical);
    // Y la primera serie es el PRIMARIO del esquema Material, no un azul suelto: la cadena
    // completa —color de marca, paleta tonal, rol, tema de exportacion— llega hasta el archivo.
    expect(documento.paleta.series[0]).toBe(temaClaro.color.primary);
  });

  it('el SVG se dibuja con el azul institucional', () => {
    const svg = aSvg(construirDocumento([kpi, barras], peticion));
    expect(svg).toContain(`fill="${temaClaro.color.primary}"`);
    expect(svg).toContain(`fill="${defaultTheme.color.surface}"`);
  });

  it('un tema distinto cambia el archivo sin tocar el generador', () => {
    // Es la prueba de que el color esta centralizado de verdad: el dia que la institucion
    // cambie su paleta, no hay que entrar en los generadores.
    const otro = {
      ...defaultTheme,
      color: { ...defaultTheme.color, categorical: ['#123456', '#654321'] },
    };
    expect(aSvg(construirDocumento([barras], peticion, otro))).toContain('fill="#123456"');
  });
});
