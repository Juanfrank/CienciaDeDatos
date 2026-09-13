import { defaultTheme, type ThemeTokens } from '@app/design-tokens';
import { construirEncabezado, type Encabezado } from './encabezado';
import type { ExportRequest, ExportableObject } from './types';

/** Documento exportable: QUE se exporta, decidido UNA sola vez. */

/** Los colores con los que se dibuja un archivo exportado. */
export interface PaletaDeExportacion {
  texto: string;
  textoAtenuado: string;
  superficie: string;
  borde: string;
  /** Color de la advertencia de vista personalizada (4.6). */
  aviso: string;
  /** Series de datos, en el orden que fija la marca. */
  series: string[];
}

export function paletaDe(theme: ThemeTokens = defaultTheme): PaletaDeExportacion {
  return {
    texto: theme.color.text,
    textoAtenuado: theme.color.textMuted,
    superficie: theme.color.surface,
    borde: theme.color.border,
    aviso: theme.color.warning,
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
export function textoDeCelda(hoja: HojaExportable, fila: number, columna: number): string {
  const formateado = hoja.textos?.[fila]?.[columna];
  if (formateado !== undefined) return formateado;
  return String(hoja.rows[fila]?.[columna] ?? '');
}

export interface DocumentoExportable {
  encabezado: Encabezado;
  hojas: HojaExportable[];
  /** Paleta institucional con la que dibujan los cuatro formatos. */
  paleta: PaletaDeExportacion;
  /** La hoja que debe dibujar un formato de una sola imagen. */
  grafico?: HojaExportable;
}

export function construirDocumento(
  objetos: ExportableObject[],
  request: ExportRequest,
  theme: ThemeTokens = defaultTheme,
): DocumentoExportable {
  const hojas: HojaExportable[] = objetos.map((o) => ({
    title: o.title,
    columns: o.result.columns,
    rows: o.result.rows,
    ...(o.textos ? { textos: o.textos } : {}),
    ...(o.notas && o.notas.length > 0 ? { notas: o.notas } : {}),
  }));

  const indiceGrafico = objetos.findIndex((o) => o.esGrafico);
  const grafico = indiceGrafico >= 0 ? hojas[indiceGrafico] : undefined;

  return {
    encabezado: construirEncabezado(request),
    hojas,
    paleta: paletaDe(theme),
    ...(grafico ? { grafico } : {}),
  };
}
