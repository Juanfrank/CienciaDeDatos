import { defaultTheme, type ThemeTokens } from '@app/design-tokens';
import { construirEncabezado, type Encabezado } from './encabezado';
import type { ExportRequest, ExportableObject } from './types';

/**
 * Documento exportable: QUE se exporta, decidido UNA sola vez.
 *
 * Los cuatro formatos parten de aqui, y ninguno decide por su cuenta que objetos entran, que
 * columnas llevan ni cual se dibuja como grafico. Antes cada formato recibia los objetos en
 * crudo y los recorria a su manera, que es como acaban divergiendo: el dia que se anada un
 * quinto formato, o que cambie lo que se considera exportable, se cambia aqui y los cuatro se
 * enteran.
 *
 * Cada hoja llega YA proyectada por `proyectarObjeto`, asi que contiene lo que el objeto muestra
 * y no el dataset entero. Esa proyeccion vive en el repositorio de objetos, no aqui: es la misma
 * que usa la tabla en pantalla y el complemento de tabla de datos.
 */

/**
 * Los colores con los que se dibuja un archivo exportado.
 *
 * Salen del TEMA, no de constantes de este paquete. Un PDF o una imagen que circulan por correo
 * llevando otros colores que la pantalla rompen la marca justo donde mas se ve, y era lo que
 * pasaba: los cuatro generadores tenian su propia paleta escrita a mano.
 *
 * Se aplana a una forma pequeña en vez de pasar el tema entero porque un generador de PDF no
 * tiene por que conocer espaciados ni radios: solo necesita saber con que pinta.
 */
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
  rows: unknown[][];
}

export interface DocumentoExportable {
  encabezado: Encabezado;
  hojas: HojaExportable[];
  /** Paleta institucional con la que dibujan los cuatro formatos. */
  paleta: PaletaDeExportacion;
  /**
   * La hoja que debe dibujar un formato de una sola imagen.
   *
   * Es el primer objeto marcado como grafico, no el primero a secas: exportar la imagen de un
   * modulo cuya primera celda es una tarjeta KPI daba un grafico de barras de un solo numero,
   * con las etiquetas repetidas y sin ningun significado.
   */
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
