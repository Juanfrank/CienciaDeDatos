import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { aExcel, aPdf } from './binarios';
import { buildDocument } from './document';
import { buildHeading } from './heading';
import { aCsv, aSvg, escaparCsv } from './formats';
import type { ExportRequest, ExportableObject } from './types';

/**
 * Lo que estas pruebas vigilan de verdad es 4.6: la procedencia de la vista tiene que sobrevivir
 * a la exportacion en LOS CUATRO formatos. Un PDF que circula por correo sin la marca de "vista
 * personalizada" es exactamente el caso que la seccion quiere evitar, y es el que se rompe solo
 * en cuanto alguien añada un formato nuevo y se olvide del encabezado.
 */

const peticion = (parcial: Partial<ExportRequest> = {}): ExportRequest => ({
  moduleSlug: 'expedientes',
  moduleName: 'Expedientes por materia',
  format: 'csv',
  requestedBy: 'ana',
  teamId: 'equipo-penal',
  provenance: { isPersonalized: false, label: 'Vista institucional oficial' },
  appliedFilters: { 'hechos.materia': ['Penal'] },
  generatedAt: '2026-03-01T10:00:00.000Z',
  ...parcial,
});

const doc = (objetos: ExportableObject[], request: ExportRequest) =>
  buildDocument(objetos, request);

const objeto: ExportableObject = {
  title: 'Casos por materia',
  result: {
    columns: [
      { name: 'materia', type: 'string' },
      { name: 'casos', type: 'number' },
    ],
    rows: [
      ['Penal', 120],
      ['Civil, comercial', 80],
      ['Con "comillas"', 45],
    ],
    source: 'mock',
    generatedAt: '2026-03-01T10:00:00.000Z',
  },
};

describe('buildHeading', () => {
  it('lleva procedencia, filtros, marca de tiempo y quien exporta', () => {
    const { titulo, lineas } = buildHeading(peticion());
    expect(titulo).toBe('Expedientes por materia');
    expect(lineas[0]).toBe('Vista institucional oficial');
    expect(lineas.join('\n')).toContain('hechos.materia = Penal');
    expect(lineas.join('\n')).toContain('ana');
    expect(lineas.join('\n')).toContain('equipo-penal');
  });

  it('anota los filtros que el ambito descarto, nombrando la dimension y no el valor', () => {
    const { lineas } = buildHeading(
      peticion({ appliedFilters: {}, outOfScopeFilters: ['DimTribunal.Distrito'] }),
    );
    const content = lineas.join('\n');
    expect(content).toContain('fuera de su ambito de acceso');
    expect(content).toContain('DimTribunal.Distrito');
  });

  it('omite la linea de filtros cuando no hay ninguno aplicado', () => {
    const { lineas } = buildHeading(peticion({ appliedFilters: { 'hechos.materia': [] } }));
    expect(lineas.some((l) => l.startsWith('Filtros:'))).toBe(false);
  });
});

describe('escaparCsv', () => {
  it('entrecomilla comas, comillas y saltos de linea', () => {
    expect(escaparCsv('Penal')).toBe('Penal');
    expect(escaparCsv('Civil, comercial')).toBe('"Civil, comercial"');
    expect(escaparCsv('Con "comillas"')).toBe('"Con ""comillas"""');
    expect(escaparCsv('dos\nlineas')).toBe('"dos\nlineas"');
  });

  it('convierte nulo y undefined en celda vacia, no en el texto "null"', () => {
    expect(escaparCsv(null)).toBe('');
    expect(escaparCsv(undefined)).toBe('');
  });
});

describe('el CSV no se convierte en un programa al abrirlo', () => {
  /**
   * Una celda que empieza por `=`, `+`, `-`, `@` o tabulador la EVALUA la hoja de calculo.
   *
   * No es una curiosidad de formato: el CSV sale de datos que escribio alguien en el sistema de
   * origen, y un nombre de parte o un titulo de expediente admiten cualquier texto. Un
   * `=HYPERLINK(...)` en una celda convierte el archivo que se descarga un juez en una peticion
   * a un servidor ajeno llevandose las cifras de al lado.
   *
   * Entrecomillar NO lo evita: el RFC 4180 dice como se delimita el campo, y la hoja de calculo
   * decide despues que hacer con lo que hay dentro.
   */
  it('desactiva lo que una hoja de calculo evaluaria', () => {
    expect(escaparCsv('=HYPERLINK("http://ajeno","ver")')).toBe(
      '"\'=HYPERLINK(""http://ajeno"",""ver"")"',
    );
    expect(escaparCsv('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
    expect(escaparCsv('+1-809-555-0100')).toBe("'+1-809-555-0100");
    expect(escaparCsv('\tcomando')).toBe("'\tcomando");
  });

  it('a un numero no se le toca, negativos incluidos', () => {
    // El CSV lleva los VALORES para poder volver a calcular con ellos. Una comilla de mas los
    // convierte en texto, y entonces el archivo deja de servir para lo que se exporto.
    expect(escaparCsv(-5)).toBe('-5');
    expect(escaparCsv('-5')).toBe('-5');
    expect(escaparCsv('-12.5')).toBe('-12.5');
    expect(escaparCsv('+3')).toBe('+3');
    expect(escaparCsv('-1.2e3')).toBe('-1.2e3');
    expect(escaparCsv(0)).toBe('0');
  });

  it('un texto corriente sigue saliendo tal cual', () => {
    expect(escaparCsv('Camara Penal')).toBe('Camara Penal');
    expect(escaparCsv('La Vega - Norte')).toBe('La Vega - Norte');
  });
});

describe('aCsv', () => {
  it('empieza con BOM para que Excel abra bien los acentos', () => {
    expect(aCsv(doc([objeto], peticion()))).toMatch(/^\uFEFF/);
  });

  it('lleva la procedencia comentada antes de la tabla', () => {
    const csv = aCsv(
      doc([objeto], peticion({ provenance: { isPersonalized: true, label: 'Vista personalizada de ana' } })),
    );
    expect(csv).toContain('# Vista personalizada de ana');
    expect(csv.indexOf('# Vista personalizada')).toBeLessThan(csv.indexOf('materia,casos'));
  });

  it('escapa los valores de las filas', () => {
    expect(aCsv(doc([objeto], peticion()))).toContain('"Civil, comercial",80');
  });
});

describe('aSvg', () => {
  it('produce un svg con una barra por fila y la procedencia escrita', () => {
    const svg = aSvg(doc([objeto], peticion({ format: 'svg' })));
    expect(svg).toMatch(/^<svg /);
    expect(svg.match(/<rect /g)?.length).toBe(1 + objeto.result.rows.length); // fondo + barras
    expect(svg).toContain('Vista institucional oficial');
  });

  it('escapa el texto de las etiquetas para no romper el xml', () => {
    const withAngles: ExportableObject = {
      title: 'Casos',
      result: { ...objeto.result, rows: [['<script>', 5]] },
    };
    const svg = aSvg(doc([withAngles], peticion({ format: 'svg' })));
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('lleva rol de imagen y etiqueta accesible (4.9)', () => {
    const svg = aSvg(doc([objeto], peticion({ format: 'svg' })));
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Casos por materia"');
  });
});

describe('aExcel', () => {
  it('genera un xlsx valido con hoja de procedencia aparte de los datos', async () => {
    const buffer = await aExcel(doc([objeto], peticion({ format: 'xlsx' })));
    // Firma de ZIP: un xlsx es un zip. Si esto falla, el archivo no abrira en Excel.
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');

    const workbook = await openWorkbook(buffer);
    expect(workbook.worksheets.map((h) => h.name)).toEqual(['Procedencia', 'Casos por materia']);

    const portada = workbook.getWorksheet('Procedencia');
    const content = (portada?.getColumn(1).values ?? []).join('\n');
    expect(content).toContain('Vista institucional oficial');
    expect(content).toContain('ana');

    const datos = workbook.getWorksheet('Casos por materia');
    expect(datos?.getRow(1).values).toEqual([undefined, 'materia', 'casos']);
    expect(datos?.getRow(2).values).toEqual([undefined, 'Penal', 120]);
  });

  it('avisa en la portada cuando lo exportado es una vista personalizada (4.6)', async () => {
    const buffer = await aExcel(
      doc(
        [objeto],
        peticion({ format: 'xlsx', provenance: { isPersonalized: true, label: 'Vista personalizada de ana' } }),
      ),
    );
    const workbook = await openWorkbook(buffer);
    const content = (workbook.getWorksheet('Procedencia')?.getColumn(1).values ?? []).join('\n');
    expect(content).toContain('VISTA PERSONALIZADA');
  });

  it('recorta el nombre de hoja a lo que Excel admite', async () => {
    const largo: ExportableObject = {
      title: 'Un titulo larguisimo que Excel no admite: con dos puntos y barras / tambien',
      result: objeto.result,
    };
    const buffer = await aExcel(doc([largo], peticion({ format: 'xlsx' })));
    const workbook = await openWorkbook(buffer);
    const nombre = workbook.worksheets[1]?.name ?? '';
    expect(nombre.length).toBeLessThanOrEqual(31);
    expect(nombre).not.toMatch(/[/\\?*[\]:]/);
  });
});

describe('aPdf', () => {
  it('genera un pdf valido', async () => {
    const buffer = await aPdf(doc([objeto], peticion({ format: 'pdf' })));
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.byteLength).toBeGreaterThan(500);
  });

  it('escribe la procedencia dentro del documento', async () => {
    const buffer = await aPdf(
      doc(
        [objeto],
        peticion({ format: 'pdf', provenance: { isPersonalized: true, label: 'Vista personalizada de ana' } }),
      ),
    );
    // pdfkit comprime los flujos de contenido; se descomprimen para leer el texto.
    expect(pdfText(buffer)).toContain('VISTA PERSONALIZADA');
  });

  it('reparte muchas filas en varias paginas', async () => {
    const muchas: ExportableObject = {
      title: 'Casos',
      result: {
        ...objeto.result,
        rows: Array.from({ length: 200 }, (_, i) => [`materia-${i}`, i]),
      },
    };
    const buffer = await aPdf(doc([muchas], peticion({ format: 'pdf' })));
    expect(pdfPages(buffer)).toBeGreaterThan(1);
  });
});

/** Abre un xlsx generado. */
async function openWorkbook(buffer: Buffer) {
  const { Workbook } = await import('exceljs');
  return new Workbook().xlsx.load(buffer as never);
}

/** Texto legible de un PDF. */
function pdfText(buffer: Buffer): string {
  let content = '';
  const mark = Buffer.from('stream');
  let desde = 0;

  for (;;) {
    const home = buffer.indexOf(mark, desde);
    if (home === -1) break;
    const end = buffer.indexOf(Buffer.from('endstream'), home);
    if (end === -1) break;
    desde = end + 1;

    const crudo = buffer.subarray(home + mark.length, end);
    const zlib = crudo.indexOf(0x78);
    if (zlib === -1) continue;
    let contenido: string;
    try {
      contenido = inflateSync(crudo.subarray(zlib)).toString('latin1');
    } catch {
      continue;
    }

    // Solo lo que va dentro de un operador de texto; el resto del flujo son coordenadas.
    for (const operador of contenido.match(/\[[^\]]*\]\s*TJ|<[0-9a-fA-F]*>\s*Tj/g) ?? []) {
      for (const trozo of operador.match(/<[0-9a-fA-F]*>/g) ?? []) {
        content += Buffer.from(trozo.slice(1, -1), 'hex').toString('latin1');
      }
    }
    content += '\n';
  }

  return content;
}

function pdfPages(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
