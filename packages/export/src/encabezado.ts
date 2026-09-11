import type { ExportRequest } from './types';

/**
 * Encabezado comun a los cuatro formatos.
 *
 * Lleva SIEMPRE la procedencia de la vista (4.6), los filtros aplicados y la marca de tiempo del
 * dato (4.8). Un archivo exportado circula por correo, se imprime y se archiva: sin esos tres
 * datos, quien lo reciba no puede saber si esta mirando la vista institucional o la version
 * personalizada de alguien, ni de cuando son las cifras.
 */
export interface Encabezado {
  titulo: string;
  lineas: string[];
  /**
   * Procedencia (4.6) como DATO, no solo como texto dentro de `lineas`.
   *
   * Excel y PDF la destacan en color y en negrita; CSV y SVG solo pueden escribirla. Si cada
   * formato tuviera que mirar la peticion para saberlo, uno acabaria olvidandose.
   */
  personalizada: boolean;
  /** Quien exporta, para los metadatos de autor del archivo. */
  autor: string;
}

export function construirEncabezado(request: ExportRequest): Encabezado {
  const lineas: string[] = [request.provenance.label];

  if (request.generatedAt) {
    lineas.push(`Datos actualizados: ${new Date(request.generatedAt).toLocaleString('es-DO')}`);
  }

  const filtros = Object.entries(request.appliedFilters).filter(([, v]) => v.length > 0);
  if (filtros.length > 0) {
    lineas.push(`Filtros: ${filtros.map(([c, v]) => `${c} = ${v.join(', ')}`).join(' | ')}`);
  }

  // Se nombra la dimension, nunca el valor pedido: decir "no se aplico Distrito = Este"
  // confirmaria que ese valor existe, que es justo lo que 4.11 pide no revelar.
  if (request.outOfScopeFilters && request.outOfScopeFilters.length > 0) {
    lineas.push(
      'Filtros no aplicados por quedar fuera de su ambito de acceso: ' +
        request.outOfScopeFilters.join(', '),
    );
  }

  lineas.push(`Exportado por: ${request.requestedBy} (equipo ${request.teamId})`);
  lineas.push(`Fecha de exportacion: ${new Date().toLocaleString('es-DO')}`);

  return {
    titulo: request.moduleName,
    lineas,
    personalizada: request.provenance.isPersonalized,
    autor: request.requestedBy,
  };
}
