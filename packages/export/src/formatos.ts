import type { ExportRequest, ExportableObject } from './types';

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

  return { titulo: request.moduleName, lineas };
}

/** Escapa un valor para CSV segun RFC 4180. */
export function escaparCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * CSV.
 *
 * Lleva el encabezado como lineas comentadas antes de la tabla. Un CSV con metadatos arriba
 * incomoda un poco al abrirlo en una hoja de calculo, pero la alternativa —perder la procedencia—
 * incumple 4.6. El BOM va delante para que Excel abra los acentos correctamente.
 */
export function aCsv(objetos: ExportableObject[], request: ExportRequest): string {
  const encabezado = construirEncabezado(request);
  const lineas: string[] = [
    `# ${encabezado.titulo}`,
    ...encabezado.lineas.map((l) => `# ${l}`),
    '',
  ];

  for (const objeto of objetos) {
    if (objetos.length > 1) lineas.push(`# ${objeto.title}`);
    lineas.push(objeto.result.columns.map((c) => escaparCsv(c.name)).join(','));
    for (const fila of objeto.result.rows) {
      lineas.push(fila.map(escaparCsv).join(','));
    }
    lineas.push('');
  }

  return `\ufeff${lineas.join('\r\n')}`;
}

/**
 * SVG de un grafico de barras.
 *
 * Se exporta VECTOR y no PNG a proposito: rasterizar exigiria un navegador o una libreria de
 * imagen en el servidor, y un SVG se abre en cualquier navegador, se incrusta en un documento y
 * escala sin perder nitidez. Si mas adelante hace falta PNG, se rasteriza desde aqui.
 */
export function aSvg(objeto: ExportableObject, request: ExportRequest, colores: string[]): string {
  const { result } = objeto;
  const encabezado = construirEncabezado(request);

  const indiceEtiqueta = 0;
  const indiceValor = result.columns.findIndex((c) => c.type === 'number');
  const filas = result.rows.slice(0, 20);

  const valores = filas.map((f) => Number(f[indiceValor >= 0 ? indiceValor : 1]) || 0);
  const maximo = Math.max(1, ...valores);

  const anchoBarra = 40;
  const separacion = 16;
  const margenIzq = 60;
  const margenSup = 40 + encabezado.lineas.length * 14;
  const altoGrafico = 220;
  const ancho = Math.max(400, margenIzq + filas.length * (anchoBarra + separacion) + 40);
  const alto = margenSup + altoGrafico + 80;

  const escapar = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const barras = filas
    .map((fila, i) => {
      const valor = valores[i] ?? 0;
      const altoBarra = (valor / maximo) * altoGrafico;
      const x = margenIzq + i * (anchoBarra + separacion);
      const y = margenSup + altoGrafico - altoBarra;
      const color = colores[i % colores.length] ?? '#4f46e5';
      return [
        `<rect x="${x}" y="${y.toFixed(1)}" width="${anchoBarra}" height="${altoBarra.toFixed(1)}" fill="${color}" />`,
        `<text x="${x + anchoBarra / 2}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="#0f172a">${valor}</text>`,
        `<text x="${x + anchoBarra / 2}" y="${margenSup + altoGrafico + 16}" text-anchor="middle" font-size="10" fill="#475569">${escapar(String(fila[indiceEtiqueta] ?? ''))}</text>`,
      ].join('');
    })
    .join('');

  const metadatos = encabezado.lineas
    .map((l, i) => `<text x="16" y="${38 + i * 14}" font-size="10" fill="#475569">${escapar(l)}</text>`)
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${escapar(objeto.title)}">`,
    `<rect width="${ancho}" height="${alto}" fill="#ffffff" />`,
    `<text x="16" y="22" font-size="14" font-weight="bold" fill="#0f172a">${escapar(encabezado.titulo)} — ${escapar(objeto.title)}</text>`,
    metadatos,
    `<line x1="${margenIzq - 8}" y1="${margenSup + altoGrafico}" x2="${ancho - 20}" y2="${margenSup + altoGrafico}" stroke="#cbd5e1" />`,
    barras,
    '</svg>',
  ].join('');
}
