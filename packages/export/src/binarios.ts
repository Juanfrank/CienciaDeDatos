import PDFDocument from 'pdfkit';
import { Workbook } from 'exceljs';
import { cellText, type ExportableDocument, type HojaExportable, type ExportPalette } from './document';

/** Formatos binarios: Excel y PDF. */

/** Ancho de columna aproximado a partir del contenido, para que no salga todo cortado. */
function columnWidth(nombre: string, valores: unknown[]): number {
  const largos = valores.map((v) => String(v ?? '').length);
  return Math.min(60, Math.max(12, nombre.length + 2, ...largos.map((l) => l + 2)));
}

export async function aExcel(document: ExportableDocument): Promise<Buffer> {
  const { heading, leaves, palette } = document;
  const libro = new Workbook();
  libro.creator = heading.autor;
  libro.created = new Date();

  /** Primera hoja: la procedencia, sola. */
  const portada = libro.addWorksheet('Procedencia');
  portada.columns = [{ width: 100 }];
  portada.addRow([heading.titulo]).font = { bold: true, size: 14 };
  if (heading.personalizada) {
    portada.addRow([]);
    const notice = portada.addRow(['VISTA PERSONALIZADA — no es la vista institucional oficial']);
    // Excel quiere ARGB de ocho digitos; el tema da un hexadecimal de seis.
    notice.font = { bold: true, color: { argb: `FF${palette.notice.replace('#', '').toUpperCase()}` } };
  }
  portada.addRow([]);
  for (const line of heading.lineas) portada.addRow([line]);

  for (const [indice, source] of leaves.entries()) {
    // Excel rechaza / \ ? * [ ] : en el nombre de hoja y lo limita a 31 caracteres.
    const nombre = source.title.replace(/[/\\?*[\]:]/g, '-').slice(0, 31) || `Datos ${indice + 1}`;
    const hoja = libro.addWorksheet(nombre);

    hoja.columns = source.columns.map((column, i) => ({
      header: column.name,
      key: `c${i}`,
      width: columnWidth(
        column.name,
        source.rows.slice(0, 200).map((f) => f[i]),
      ),
    }));
    hoja.getRow(1).font = { bold: true };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    for (const fila of source.rows) hoja.addRow(fila);

    if (source.rows.length > 0) {
      hoja.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: source.columns.length },
      };
    }
  }

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const WIDTH_PAGE = 595.28; // A4 en puntos
const MARGIN = 40;

export function aPdf(document: ExportableDocument): Promise<Buffer> {
  const { heading, leaves, palette } = document;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const trozos: Buffer[] = [];
    doc.on('data', (t: Buffer) => trozos.push(t));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).fillColor(palette.content).text(heading.titulo);
    doc.moveDown(0.3);

    if (heading.personalizada) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(palette.notice)
        .text('VISTA PERSONALIZADA — no es la vista institucional oficial');
      doc.moveDown(0.2);
    }

    doc.font('Helvetica').fontSize(8).fillColor(palette.textoAtenuado);
    for (const line of heading.lineas) doc.text(line);
    doc.moveDown(0.8);

    for (const hoja of leaves) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(palette.content).text(hoja.title);
      doc.moveDown(0.3);
      drawTable(doc, hoja, palette);

      /*
       * Las notas, DEBAJO de su tabla.
       */
      for (const nota of hoja.notas ?? []) {
        doc.font('Helvetica-Oblique').fontSize(7).fillColor(palette.textoAtenuado).text(nota);
      }
      doc.moveDown(1);
    }

    // Paginacion al final, cuando ya se sabe cuantas paginas hay.
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i += 1) {
      doc.switchToPage(rango.start + i);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(palette.textoAtenuado)
        .text(
          `${heading.titulo} — pagina ${i + 1} de ${rango.count}`,
          MARGIN,
          doc.page.height - 28,
          { width: WIDTH_PAGE - MARGIN * 2, align: 'center' },
        );
    }

    doc.end();
  });
}

/** Tabla simple con salto de pagina y repeticion de cabecera. */
function drawTable(
  doc: PDFKit.PDFDocument,
  hoja: HojaExportable,
  palette: ExportPalette,
): void {
  const gridColumns = hoja.columns;
  if (gridColumns.length === 0) return;

  const anchoUtil = WIDTH_PAGE - MARGIN * 2;
  const widthColumn = anchoUtil / gridColumns.length;
  const heightRow = 14;
  const limiteInferior = doc.page.height - 45;

  const pageHeader = (): void => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(palette.content);
    gridColumns.forEach((c, i) => {
      doc.text(c.name, MARGIN + i * widthColumn, y, {
        width: widthColumn - 4,
        ellipsis: true,
        lineBreak: false,
      });
    });
    doc.y = y + heightRow;
    doc
      .moveTo(MARGIN, doc.y - 3)
      .lineTo(WIDTH_PAGE - MARGIN, doc.y - 3)
      .strokeColor(palette.borde)
      .lineWidth(0.5)
      .stroke();
  };

  pageHeader();

  doc.font('Helvetica').fontSize(8).fillColor(palette.content);
  hoja.rows.forEach((_, f) => {
    if (doc.y + heightRow > limiteInferior) {
      doc.addPage();
      pageHeader();
      doc.font('Helvetica').fontSize(8).fillColor(palette.content);
    }
    const y = doc.y;
    gridColumns.forEach((_, i) => {
      // El texto formateado, no el valor: un PDF que dice «2216» contradice a la pantalla de la
      // que salio, donde ponia «2,216 casos».
      doc.text(cellText(hoja, f, i), MARGIN + i * widthColumn, y, {
        width: widthColumn - 4,
        ellipsis: true,
        lineBreak: false,
      });
    });
    doc.y = y + heightRow;
  });
}
