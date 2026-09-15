import { cellText, type ExportableDocument, type ExportableSheet } from './document';

/** Formatos de texto: CSV y SVG. */

/**
 * Un valor que una hoja de calculo leeria como FORMULA y no como dato.
 *
 * Excel, LibreOffice y Google Sheets evaluan la celda que empieza por `=`, `+`, `-`, `@` o por
 * un tabulador. Comillas incluidas: entrecomillar cumple el RFC 4180 y no evita nada, porque el
 * RFC habla de como se delimita el campo y la hoja de calculo decide DESPUES que hacer con su
 * contenido.
 *
 * Aqui importa porque el CSV sale de datos que escribio alguien en el sistema de origen. Un
 * nombre de parte o un titulo de expediente admite cualquier texto, y `=HYPERLINK(...)` en una
 * celda convierte el archivo que se descarga un juez en una peticion a un servidor ajeno
 * llevandose las cifras de al lado.
 */
const FORMULA = /^[=+\-@\t\r]/;

/** Un numero escrito como texto. `-5` empieza por `-` y no es ninguna formula. */
const NUMERO = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * Escapa un valor para CSV segun RFC 4180, y lo desactiva como formula si lo parecia.
 *
 * Se antepone una comilla simple, que es lo que la hoja de calculo entiende como «esto es texto,
 * no lo evalues». Se hace SOLO cuando hace falta: a un numero no se le toca —ni a los negativos,
 * que empiezan por el mismo signo— porque el CSV lleva los valores para volver a calcular con
 * ellos, y una comilla de mas los convertiria en texto.
 */
export function escaparCsv(valor: unknown): string {
  const bruto = valor === null || valor === undefined ? '' : String(valor);
  const content =
    typeof valor !== 'number' && FORMULA.test(bruto) && !NUMERO.test(bruto) ? `'${bruto}` : bruto;
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

  for (const sheet of leaves) {
    if (leaves.length > 1) lineas.push(`# ${sheet.title}`);
    lineas.push(sheet.columns.map((c) => escaparCsv(c.name)).join(','));
    /*
     * El CSV lleva los VALORES, no los textos formateados.
     */
    for (const fila of sheet.rows) {
      lineas.push(fila.map(escaparCsv).join(','));
    }
    // Las notas, como comentario: un CSV no tiene donde dibujar una meta, pero quien lo reciba
    // tiene que poder saber contra que se leian esas cifras.
    for (const nota of sheet.notas ?? []) lineas.push(`# ${nota}`);
    lineas.push('');
  }

  return `\uFEFF${lineas.join('\r\n')}`;
}

const escaparXml = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** SVG de un grafico de barras. */
export function aSvg(document: ExportableDocument): string {
  const sheet: ExportableSheet | undefined = document.grafico ?? document.leaves[0];
  const { heading, palette } = document;

  if (!sheet) throw new Error('No hay ningun objeto con datos que dibujar.');

  const valueIndex = Math.max(
    0,
    sheet.columns.findIndex((c) => c.type === 'number'),
  );
  const dataRows = sheet.rows.slice(0, 20);
  const valores = dataRows.map((f) => Number(f[valueIndex]) || 0);
  // La cifra sobre la barra, con el formato de la pantalla. Lo demas ya se hizo en el lienzo:
  // aqui pasaba lo mismo que pasaba alli, y por el mismo motivo — nadie habia pasado el formato.
  const textos = dataRows.map((_, i) => cellText(sheet, i, valueIndex));
  const maximo = Math.max(1, ...valores);

  const widthBar = 40;
  const separacion = 16;
  const leftMargin = 60;
  const topMargin = 40 + heading.lineas.length * 14;
  const heightChart = 220;
  const ancho = Math.max(400, leftMargin + dataRows.length * (widthBar + separacion) + 40);
  const notas = sheet.notas ?? [];
  // Se reserva alto para las notas: escritas sobre el area de dibujo taparian las barras, y
  // fuera del `viewBox` no se verian en absoluto.
  const alto = topMargin + heightChart + 80 + notas.length * 14;

  const barras = dataRows
    .map((fila, i) => {
      const valor = valores[i] ?? 0;
      const heightBar = (valor / maximo) * heightChart;
      const x = leftMargin + i * (widthBar + separacion);
      const y = topMargin + heightChart - heightBar;
      const color = palette.series[i % palette.series.length] ?? palette.content;
      return [
        `<rect x="${x}" y="${y.toFixed(1)}" width="${widthBar}" height="${heightBar.toFixed(1)}" fill="${color}" />`,
        `<text x="${x + widthBar / 2}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="${palette.content}">${escaparXml(textos[i] ?? String(valor))}</text>`,
        `<text x="${x + widthBar / 2}" y="${topMargin + heightChart + 16}" text-anchor="middle" font-size="10" fill="${palette.mutedText}">${escaparXml(String(fila[0] ?? ''))}</text>`,
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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${escaparXml(sheet.title)}">`,
    `<rect width="${ancho}" height="${alto}" fill="${palette.superficie}" />`,
    `<text x="16" y="22" font-size="14" font-weight="bold" fill="${palette.content}">${escaparXml(heading.titulo)} — ${escaparXml(sheet.title)}</text>`,
    metadatos,
    `<line x1="${leftMargin - 8}" y1="${topMargin + heightChart}" x2="${ancho - 20}" y2="${topMargin + heightChart}" stroke="${palette.borde}" />`,
    barras,
    ...notas.map(
      (nota, i) =>
        `<text x="16" y="${topMargin + heightChart + 60 + i * 14}" font-size="10" fill="${palette.mutedText}">${escaparXml(nota)}</text>`,
    ),
    '</svg>',
  ].join('');
}
