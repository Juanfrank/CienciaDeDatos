import { defaultTheme, lightTheme } from '@app/design-tokens';
import { describe, expect, it } from 'vitest';
import { buildDocument, paletteOf, cellText, type ExportableSheet } from './document';
import { aCsv } from './formats';
import type { ExportRequest, ExportableObject } from './types';

/**
 * El documento es lo que hace que los cuatro formatos no puedan divergir: QUE se exporta se
 * decide una sola vez, y cada formato solo decide COMO se dibuja.
 */

const peticion: ExportRequest = {
  moduleSlug: 'casos',
  moduleName: 'Casos pendientes',
  format: 'pdf',
  requestedBy: 'ana',
  teamId: 'equipo-norte',
  provenance: { isPersonalized: false, label: 'Vista institucional oficial' },
  appliedFilters: {},
};

const objeto = (title: string, isChart: boolean, dataRows: unknown[][]): ExportableObject => ({
  title,
  isChart,
  result: {
    columns: [
      { name: 'categoria', type: 'string' },
      { name: 'valor', type: 'number' },
    ],
    rows: dataRows,
    source: 'mock',
    generatedAt: '2026-03-01T10:00:00.000Z',
  },
});

const kpi = objeto('Casos pendientes', false, [['Casos pendientes', 65]]);
const barras = objeto('Pendientes por distrito', true, [
  ['Norte', 35],
  ['Sur', 30],
]);

describe('buildDocument', () => {
  it('lleva una hoja por objeto, en el mismo orden', () => {
    const document = buildDocument([kpi, barras], peticion);
    expect(document.leaves.map((h) => h.title)).toEqual([
      'Casos pendientes',
      'Pendientes por distrito',
    ]);
  });

  it('elige como grafico el primer objeto MARCADO como grafico, no el primero a secas', () => {
    // Este es el arreglo: con la primera celda ocupada por una tarjeta KPI, la imagen exportada
    // era un grafico de barras de un solo numero, con la etiqueta repetida y sin significado.
    const document = buildDocument([kpi, barras], peticion);
    expect(document.grafico?.title).toBe('Pendientes por distrito');
  });

  it('sin ningun objeto marcado como grafico, el campo se queda vacio', () => {
    const document = buildDocument([kpi], peticion);
    expect(document.grafico).toBeUndefined();
    // Y las hojas siguen ahi: lo que no hay es una figura que destacar, no datos.
    expect(document.leaves[0]?.title).toBe('Casos pendientes');
  });

  it('construye el encabezado una sola vez, para los tres formatos', () => {
    const document = buildDocument([barras], peticion);
    expect(document.heading.titulo).toBe('Casos pendientes');
    expect(document.heading.personalizada).toBe(false);
    expect(document.heading.autor).toBe('ana');
  });

  it('marca la procedencia como dato, no solo como texto: Excel y PDF la destacan', () => {
    const document = buildDocument(
      [barras],
      { ...peticion, provenance: { isPersonalized: true, label: 'Vista personalizada de ana' } },
    );
    expect(document.heading.personalizada).toBe(true);
  });
});

describe('la marca institucional llega al archivo exportado', () => {
  it('las series del documento son las del tema, no una paleta propia del exportador', () => {
    // Era el hueco: los cuatro generadores tenian sus colores escritos a mano, asi que un PDF
    // que circula por correo salia con otra paleta que la pantalla.
    const document = buildDocument([barras], peticion);
    expect(document.palette.series).toEqual(defaultTheme.color.categorical);
    // Y la primera serie es el PRIMARIO del esquema Material, no un azul suelto: la cadena
    // completa —color de marca, paleta tonal, rol, tema de exportacion— llega hasta el archivo.
    expect(document.palette.series[0]).toBe(lightTheme.color.primary);
  });

  it('un tema distinto cambia el archivo sin tocar el generador', () => {
    // Es la prueba de que el color esta centralizado de verdad: el dia que la institucion
    // cambie su paleta, no hay que entrar en los generadores.
    const other = {
      ...defaultTheme,
      color: { ...defaultTheme.color, categorical: ['#123456', '#654321'] },
    };
    expect(buildDocument([barras], peticion, other).palette.series[0]).toBe('#123456');
  });
});

describe('lo que se lee y lo que se calcula no son lo mismo', () => {
  const sheet = (): ExportableSheet => ({
    title: 'Casos',
    columns: [
      { name: 'Trimestre', type: 'string' },
      { name: 'CasosPendientes', type: 'number' },
    ],
    rows: [['Q1', 2216]],
    textos: [['Q1', '2,216 casos']],
    notas: ['Meta: 900'],
  });

  it('el texto de una celda es el de la pantalla', () => {
    expect(cellText(sheet(), 0, 1)).toBe('2,216 casos');
  });

  it('sin texto formateado cae al valor, no a una celda vacia', () => {
    /*
     * Una celda vacia se leeria como «no hay dato», que es una afirmacion distinta de «este
     * objeto no declara formato».
     */
    const withoutTexts: ExportableSheet = { ...sheet(), textos: undefined as unknown as string[][] };
    expect(cellText(withoutTexts, 0, 1)).toBe('2216');
  });

  it('el CSV lleva el VALOR, no el texto: un CSV se calcula, no se lee', () => {
    /*
     * «2,216» en un CSV es un dato roto: quien lo abra en una hoja de calculo no puede sumarlo, y
     * la coma ademas parte la celda.
     */
    const csv = aCsv({
      heading: { titulo: 'T', lineas: [], personalizada: false, autor: 'u-admin' },
      leaves: [sheet()],
      palette: paletteOf(),
    });
    expect(csv).toContain('2216');
    expect(csv).not.toContain('"2,216 casos"');
  });

  it('y aun asi el CSV no pierde la meta: va como comentario', () => {
    const csv = aCsv({
      heading: { titulo: 'T', lineas: [], personalizada: false, autor: 'u-admin' },
      leaves: [sheet()],
      palette: paletteOf(),
    });
    expect(csv).toContain('# Meta: 900');
  });

});
