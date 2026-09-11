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

export interface HojaExportable {
  title: string;
  columns: { name: string; type: string }[];
  rows: unknown[][];
}

export interface DocumentoExportable {
  encabezado: Encabezado;
  hojas: HojaExportable[];
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
    ...(grafico ? { grafico } : {}),
  };
}
