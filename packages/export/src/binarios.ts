import PDFDocument from 'pdfkit';
import { Workbook } from 'exceljs';
import type { DocumentoExportable, HojaExportable } from './documento';

/**
 * Formatos binarios: Excel y PDF.
 *
 * Van en un modulo aparte de `formatos.ts` porque exigen librerias de Node (exceljs, pdfkit).
 * CSV y SVG son cadenas de texto y se generan sin dependencias, asi que pueden usarse desde
 * cualquier parte; estos dos solo corren en el proceso de servidor que atiende la cola (5.3).
 *
 * Como los otros dos, parten del `DocumentoExportable` ya construido y no deciden nada sobre su
 * contenido. De ahi que los cuatro lleven el mismo encabezado —procedencia (4.6), filtros y
 * marca de tiempo (4.8)— sin que ninguno tenga que acordarse de ponerlo.
 */

/** Ancho de columna aproximado a partir del contenido, para que no salga todo cortado. */
function anchoDeColumna(nombre: string, valores: unknown[]): number {
  const largos = valores.map((v) => String(v ?? '').length);
  return Math.min(60, Math.max(12, nombre.length + 2, ...largos.map((l) => l + 2)));
}

export async function aExcel(documento: DocumentoExportable): Promise<Buffer> {
  const { encabezado, hojas } = documento;
  const libro = new Workbook();
  libro.creator = encabezado.autor;
  libro.created = new Date();

  /**
   * Primera hoja: la procedencia, sola.
   *
   * En Excel el encabezado NO va encima de la tabla: una hoja de datos con cinco filas de
   * metadatos delante rompe los filtros, las tablas dinamicas y cualquier formula que apunte a
   * un rango. Se pone en su propia hoja, que es visible al abrir el archivo y no estorba.
   */
  const portada = libro.addWorksheet('Procedencia');
  portada.columns = [{ width: 100 }];
  portada.addRow([encabezado.titulo]).font = { bold: true, size: 14 };
  if (encabezado.personalizada) {
    portada.addRow([]);
    const aviso = portada.addRow(['VISTA PERSONALIZADA — no es la vista institucional oficial']);
    aviso.font = { bold: true, color: { argb: 'FFB45309' } };
  }
  portada.addRow([]);
  for (const linea of encabezado.lineas) portada.addRow([linea]);

  for (const [indice, fuente] of hojas.entries()) {
    // Excel rechaza / \ ? * [ ] : en el nombre de hoja y lo limita a 31 caracteres.
    const nombre = fuente.title.replace(/[/\\?*[\]:]/g, '-').slice(0, 31) || `Datos ${indice + 1}`;
    const hoja = libro.addWorksheet(nombre);

    hoja.columns = fuente.columns.map((columna, i) => ({
      header: columna.name,
      key: `c${i}`,
      width: anchoDeColumna(
        columna.name,
        fuente.rows.slice(0, 200).map((f) => f[i]),
      ),
    }));
    hoja.getRow(1).font = { bold: true };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    for (const fila of fuente.rows) hoja.addRow(fila);

    if (fuente.rows.length > 0) {
      hoja.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: fuente.columns.length },
      };
    }
  }

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const ANCHO_PAGINA = 595.28; // A4 en puntos
const MARGEN = 40;

export function aPdf(documento: DocumentoExportable): Promise<Buffer> {
  const { encabezado, hojas } = documento;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGEN, bufferPages: true });
    const trozos: Buffer[] = [];
    doc.on('data', (t: Buffer) => trozos.push(t));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(encabezado.titulo);
    doc.moveDown(0.3);

    if (encabezado.personalizada) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#b45309')
        .text('VISTA PERSONALIZADA — no es la vista institucional oficial');
      doc.moveDown(0.2);
    }

    doc.font('Helvetica').fontSize(8).fillColor('#475569');
    for (const linea of encabezado.lineas) doc.text(linea);
    doc.moveDown(0.8);

    for (const hoja of hojas) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(hoja.title);
      doc.moveDown(0.3);
      dibujarTabla(doc, hoja);
      doc.moveDown(1);
    }

    // Paginacion al final, cuando ya se sabe cuantas paginas hay.
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i += 1) {
      doc.switchToPage(rango.start + i);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          `${encabezado.titulo} — pagina ${i + 1} de ${rango.count}`,
          MARGEN,
          doc.page.height - 28,
          { width: ANCHO_PAGINA - MARGEN * 2, align: 'center' },
        );
    }

    doc.end();
  });
}

/** Tabla simple con salto de pagina y repeticion de cabecera. */
function dibujarTabla(doc: PDFKit.PDFDocument, hoja: HojaExportable): void {
  const columnas = hoja.columns;
  if (columnas.length === 0) return;

  const anchoUtil = ANCHO_PAGINA - MARGEN * 2;
  const anchoColumna = anchoUtil / columnas.length;
  const altoFila = 14;
  const limiteInferior = doc.page.height - 45;

  const cabecera = (): void => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
    columnas.forEach((c, i) => {
      doc.text(c.name, MARGEN + i * anchoColumna, y, {
        width: anchoColumna - 4,
        ellipsis: true,
        lineBreak: false,
      });
    });
    doc.y = y + altoFila;
    doc
      .moveTo(MARGEN, doc.y - 3)
      .lineTo(ANCHO_PAGINA - MARGEN, doc.y - 3)
      .strokeColor('#cbd5e1')
      .lineWidth(0.5)
      .stroke();
  };

  cabecera();

  doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
  for (const fila of hoja.rows) {
    if (doc.y + altoFila > limiteInferior) {
      doc.addPage();
      cabecera();
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
    }
    const y = doc.y;
    columnas.forEach((_, i) => {
      doc.text(String(fila[i] ?? ''), MARGEN + i * anchoColumna, y, {
        width: anchoColumna - 4,
        ellipsis: true,
        lineBreak: false,
      });
    });
    doc.y = y + altoFila;
  }
}
