import PDFDocument from 'pdfkit';
import { Workbook } from 'exceljs';
import { construirEncabezado } from './formatos';
import type { ExportRequest, ExportableObject } from './types';

/**
 * Formatos binarios: Excel y PDF.
 *
 * Van en un modulo aparte de `formatos.ts` porque exigen librerias de Node (exceljs, pdfkit).
 * CSV y SVG son cadenas de texto y se generan sin dependencias, asi que pueden usarse desde
 * cualquier parte; estos dos solo corren en el proceso de servidor que atiende la cola (5.3).
 *
 * Los dos incrustan el MISMO encabezado que CSV y SVG: procedencia (4.6), filtros aplicados y
 * marca de tiempo del dato (4.8). Es el punto del que depende que 4.6 siga valiendo fuera de la
 * aplicacion.
 */

/** Ancho de columna aproximado a partir del contenido, para que no salga todo cortado. */
function anchoDeColumna(nombre: string, valores: unknown[]): number {
  const largos = valores.map((v) => String(v ?? '').length);
  return Math.min(60, Math.max(12, nombre.length + 2, ...largos.map((l) => l + 2)));
}

export async function aExcel(
  objetos: ExportableObject[],
  request: ExportRequest,
): Promise<Buffer> {
  const encabezado = construirEncabezado(request);
  const libro = new Workbook();
  libro.creator = request.requestedBy;
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
  if (request.provenance.isPersonalized) {
    portada.addRow([]);
    const aviso = portada.addRow(['VISTA PERSONALIZADA — no es la vista institucional oficial']);
    aviso.font = { bold: true, color: { argb: 'FFB45309' } };
  }
  portada.addRow([]);
  for (const linea of encabezado.lineas) portada.addRow([linea]);

  for (const [indice, objeto] of objetos.entries()) {
    // Excel rechaza / \ ? * [ ] : en el nombre de hoja y lo limita a 31 caracteres.
    const nombre = objeto.title.replace(/[/\\?*[\]:]/g, '-').slice(0, 31) || `Datos ${indice + 1}`;
    const hoja = libro.addWorksheet(nombre);

    hoja.columns = objeto.result.columns.map((columna, i) => ({
      header: columna.name,
      key: `c${i}`,
      width: anchoDeColumna(
        columna.name,
        objeto.result.rows.slice(0, 200).map((f) => f[i]),
      ),
    }));
    hoja.getRow(1).font = { bold: true };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    for (const fila of objeto.result.rows) hoja.addRow(fila);

    if (objeto.result.rows.length > 0) {
      hoja.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: objeto.result.columns.length },
      };
    }
  }

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const ANCHO_PAGINA = 595.28; // A4 en puntos
const MARGEN = 40;

export function aPdf(objetos: ExportableObject[], request: ExportRequest): Promise<Buffer> {
  const encabezado = construirEncabezado(request);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGEN, bufferPages: true });
    const trozos: Buffer[] = [];
    doc.on('data', (t: Buffer) => trozos.push(t));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(encabezado.titulo);
    doc.moveDown(0.3);

    if (request.provenance.isPersonalized) {
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

    for (const objeto of objetos) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(objeto.title);
      doc.moveDown(0.3);
      dibujarTabla(doc, objeto);
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
          `${request.moduleName} — pagina ${i + 1} de ${rango.count}`,
          MARGEN,
          doc.page.height - 28,
          { width: ANCHO_PAGINA - MARGEN * 2, align: 'center' },
        );
    }

    doc.end();
  });
}

/** Tabla simple con salto de pagina y repeticion de cabecera. */
function dibujarTabla(doc: PDFKit.PDFDocument, objeto: ExportableObject): void {
  const columnas = objeto.result.columns;
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
  for (const fila of objeto.result.rows) {
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
