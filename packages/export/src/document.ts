import { defaultTheme, type ThemeTokens } from '@app/design-tokens';
import { buildHeading, type Heading } from './heading';
import type { ExportRequest, ExportableObject } from './types';

/** Documento exportable: QUE se exporta, decidido UNA sola vez. */

/** Los colores con los que se dibuja un archivo exportado. */
export interface ExportPalette {
  content: string;
  mutedText: string;
  superficie: string;
  borde: string;
  /** Color de la advertencia de vista personalizada (4.6). */
  notice: string;
  /** Series de datos, en el orden que fija la marca. */
  series: string[];
}

export function paletteOf(theme: ThemeTokens = defaultTheme): ExportPalette {
  return {
    content: theme.color.text,
    mutedText: theme.color.textMuted,
    superficie: theme.color.surface,
    borde: theme.color.border,
    notice: theme.color.warning,
    series: theme.color.categorical,
  };
}

export interface HojaExportable {
  title: string;
  columns: { name: string; type: string }[];
  /** Los valores, sin formatear. Es lo que va al CSV y al XLSX, donde un numero debe ser numero. */
  rows: unknown[][];
  /** Los mismos valores como se ven en pantalla. Es lo que va al PDF y al SVG. */
  textos?: string[][];
  /** Metas, umbrales y reglas de color, en texto. */
  notas?: string[];
}

/** El texto de una celda, para los formatos que se LEEN. */
export function cellText(hoja: HojaExportable, fila: number, column: number): string {
  const formateado = hoja.textos?.[fila]?.[column];
  if (formateado !== undefined) return formateado;
  return String(hoja.rows[fila]?.[column] ?? '');
}

export interface ExportableDocument {
  heading: Heading;
  leaves: HojaExportable[];
  /** Paleta institucional con la que dibujan los cuatro formatos. */
  palette: ExportPalette;
  /** La hoja que debe dibujar un formato de una sola imagen. */
  grafico?: HojaExportable;
}

export function buildDocument(
  objetos: ExportableObject[],
  request: ExportRequest,
  theme: ThemeTokens = defaultTheme,
): ExportableDocument {
  const leaves: HojaExportable[] = objetos.map((o) => ({
    title: o.title,
    columns: o.result.columns,
    rows: o.result.rows,
    ...(o.textos ? { textos: o.textos } : {}),
    ...(o.notas && o.notas.length > 0 ? { notas: o.notas } : {}),
  }));

  const indiceGrafico = objetos.findIndex((o) => o.isChart);
  const grafico = indiceGrafico >= 0 ? leaves[indiceGrafico] : undefined;

  return {
    heading: buildHeading(request),
    leaves,
    palette: paletteOf(theme),
    ...(grafico ? { grafico } : {}),
  };
}
