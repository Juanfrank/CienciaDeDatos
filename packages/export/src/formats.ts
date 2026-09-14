import { cellText, type ExportableDocument, type HojaExportable } from './document';

/** Formatos de texto: CSV y SVG. */

/** Escapa un valor para CSV segun RFC 4180. */
export function escaparCsv(valor: unknown): string {
  const content = valor === null || valor === undefined ? '' : String(valor);
  return /[",\n\r]/.test(content) ? `"${content.replace(/"/g, '""')}"` : content;
}

/** CSV. */
export function aCsv(document: ExportableDocument): string {
  const { heading, leaves } = document;
  const lineas: string[] = [
    `# ${heading.titulo}`,
    ...heading.lineas.map((l) => `# ${l}`),
    '',
  ];

  for (const hoja of leaves) {
    if (leaves.length > 1) lineas.push(`# ${hoja.title}`);
    lineas.push(hoja.columns.map((c) => escaparCsv(c.name)).join(','));
    /*
     * El CSV lleva los VALORES, no los textos formateados.
     */
    for (const fila of hoja.rows) {
      lineas.push(fila.map(escaparCsv).join(','));
    }
    // Las notas, como comentario: un CSV no tiene donde dibujar una meta, pero quien lo reciba
    // tiene que poder saber contra que se leian esas cifras.
    for (const nota of hoja.notas ?? []) lineas.push(`# ${nota}`);
    lineas.push('');
  }

  return `\uFEFF${lineas.join('\r\n')}`;
}

const escaparXml = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** SVG de un grafico de barras. */
export function aSvg(document: ExportableDocument): string {
  const hoja: HojaExportable | undefined = document.grafico ?? document.leaves[0];
  const { heading, palette } = document;

  if (!hoja) throw new Error('No hay ningun objeto con datos que dibujar.');

  const indiceValor = Math.max(
    0,
    hoja.columns.findIndex((c) => c.type === 'number'),
  );
  const dataRows = hoja.rows.slice(0, 20);
  const valores = dataRows.map((f) => Number(f[indiceValor]) || 0);
  // La cifra sobre la barra, con el formato de la pantalla. Lo demas ya se hizo en el lienzo:
  // aqui pasaba lo mismo que pasaba alli, y por el mismo motivo — nadie habia pasado el formato.
  const textos = dataRows.map((_, i) => cellText(hoja, i, indiceValor));
  const maximo = Math.max(1, ...valores);

  const widthBar = 40;
  const separacion = 16;
  const margenIzq = 60;
  const margenSup = 40 + heading.lineas.length * 14;
  const heightChart = 220;
  const ancho = Math.max(400, margenIzq + dataRows.length * (widthBar + separacion) + 40);
  const notas = hoja.notas ?? [];
  // Se reserva alto para las notas: escritas sobre el area de dibujo taparian las barras, y
  // fuera del `viewBox` no se verian en absoluto.
  const alto = margenSup + heightChart + 80 + notas.length * 14;

  const barras = dataRows
    .map((fila, i) => {
      const valor = valores[i] ?? 0;
      const heightBar = (valor / maximo) * heightChart;
      const x = margenIzq + i * (widthBar + separacion);
      const y = margenSup + heightChart - heightBar;
      const color = palette.series[i % palette.series.length] ?? palette.content;
      return [
        `<rect x="${x}" y="${y.toFixed(1)}" width="${widthBar}" height="${heightBar.toFixed(1)}" fill="${color}" />`,
        `<text x="${x + widthBar / 2}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="${palette.content}">${escaparXml(textos[i] ?? String(valor))}</text>`,
        `<text x="${x + widthBar / 2}" y="${margenSup + heightChart + 16}" text-anchor="middle" font-size="10" fill="${palette.mutedText}">${escaparXml(String(fila[0] ?? ''))}</text>`,
      ].join('');
    })
    .join('');

  const metadatos = heading.lineas
    .map(
      (l, i) =>
        `<text x="16" y="${38 + i * 14}" font-size="10" fill="${palette.mutedText}">${escaparXml(l)}</text>`,
    )
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${escaparXml(hoja.title)}">`,
    `<rect width="${ancho}" height="${alto}" fill="${palette.superficie}" />`,
    `<text x="16" y="22" font-size="14" font-weight="bold" fill="${palette.content}">${escaparXml(heading.titulo)} — ${escaparXml(hoja.title)}</text>`,
    metadatos,
    `<line x1="${margenIzq - 8}" y1="${margenSup + heightChart}" x2="${ancho - 20}" y2="${margenSup + heightChart}" stroke="${palette.borde}" />`,
    barras,
    ...notas.map(
      (nota, i) =>
        `<text x="16" y="${margenSup + heightChart + 60 + i * 14}" font-size="10" fill="${palette.mutedText}">${escaparXml(nota)}</text>`,
    ),
    '</svg>',
  ].join('');
}
