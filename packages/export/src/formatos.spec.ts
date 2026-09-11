import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { aExcel, aPdf } from './binarios';
import { construirDocumento } from './documento';
import { construirEncabezado } from './encabezado';
import { aCsv, aSvg, escaparCsv } from './formatos';
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
  construirDocumento(objetos, request);

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

describe('construirEncabezado', () => {
  it('lleva procedencia, filtros, marca de tiempo y quien exporta', () => {
    const { titulo, lineas } = construirEncabezado(peticion());
    expect(titulo).toBe('Expedientes por materia');
    expect(lineas[0]).toBe('Vista institucional oficial');
    expect(lineas.join('\n')).toContain('hechos.materia = Penal');
    expect(lineas.join('\n')).toContain('ana');
    expect(lineas.join('\n')).toContain('equipo-penal');
  });

  it('anota los filtros que el ambito descarto, nombrando la dimension y no el valor', () => {
    const { lineas } = construirEncabezado(
      peticion({ appliedFilters: {}, outOfScopeFilters: ['DimTribunal.Distrito'] }),
    );
    const texto = lineas.join('\n');
    expect(texto).toContain('fuera de su ambito de acceso');
    expect(texto).toContain('DimTribunal.Distrito');
  });

  it('omite la linea de filtros cuando no hay ninguno aplicado', () => {
    const { lineas } = construirEncabezado(peticion({ appliedFilters: { 'hechos.materia': [] } }));
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
    const svg = aSvg(doc([objeto], peticion({ format: 'svg' })), ['#4f46e5']);
    expect(svg).toMatch(/^<svg /);
    expect(svg.match(/<rect /g)?.length).toBe(1 + objeto.result.rows.length); // fondo + barras
    expect(svg).toContain('Vista institucional oficial');
  });

  it('escapa el texto de las etiquetas para no romper el xml', () => {
    const conAngulos: ExportableObject = {
      title: 'Casos',
      result: { ...objeto.result, rows: [['<script>', 5]] },
    };
    const svg = aSvg(doc([conAngulos], peticion({ format: 'svg' })), ['#4f46e5']);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('lleva rol de imagen y etiqueta accesible (4.9)', () => {
    const svg = aSvg(doc([objeto], peticion({ format: 'svg' })), ['#4f46e5']);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Casos por materia"');
  });
});

describe('aExcel', () => {
  it('genera un xlsx valido con hoja de procedencia aparte de los datos', async () => {
    const buffer = await aExcel(doc([objeto], peticion({ format: 'xlsx' })));
    // Firma de ZIP: un xlsx es un zip. Si esto falla, el archivo no abrira en Excel.
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');

    const libro = await abrirLibro(buffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Procedencia', 'Casos por materia']);

    const portada = libro.getWorksheet('Procedencia');
    const texto = (portada?.getColumn(1).values ?? []).join('\n');
    expect(texto).toContain('Vista institucional oficial');
    expect(texto).toContain('ana');

    const datos = libro.getWorksheet('Casos por materia');
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
    const libro = await abrirLibro(buffer);
    const texto = (libro.getWorksheet('Procedencia')?.getColumn(1).values ?? []).join('\n');
    expect(texto).toContain('VISTA PERSONALIZADA');
  });

  it('recorta el nombre de hoja a lo que Excel admite', async () => {
    const largo: ExportableObject = {
      title: 'Un titulo larguisimo que Excel no admite: con dos puntos y barras / tambien',
      result: objeto.result,
    };
    const buffer = await aExcel(doc([largo], peticion({ format: 'xlsx' })));
    const libro = await abrirLibro(buffer);
    const nombre = libro.worksheets[1]?.name ?? '';
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
    expect(textoDePdf(buffer)).toContain('VISTA PERSONALIZADA');
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
    expect(paginasDePdf(buffer)).toBeGreaterThan(1);
  });
});

/**
 * Abre un xlsx generado.
 *
 * El `as never` es por exceljs: sus tipos declaran un `Buffer` propio, heredado de una version
 * antigua de @types/node, que ya no coincide con el `Buffer` del Node actual. El valor que se le
 * pasa es el correcto —lo confirma que el libro se lea— y el desajuste es solo de declaracion.
 */
async function abrirLibro(buffer: Buffer) {
  const { Workbook } = await import('exceljs');
  return new Workbook().xlsx.load(buffer as never);
}

/**
 * Texto legible de un PDF.
 *
 * pdfkit comprime los flujos de contenido con Flate y escribe el texto como cadenas
 * hexadecimales dentro de operadores `TJ`/`Tj`. Con las fuentes estandar (Helvetica) los codigos
 * son los del propio caracter en WinAnsi, asi que basta decodificar el hexadecimal.
 */
function textoDePdf(buffer: Buffer): string {
  let texto = '';
  const marca = Buffer.from('stream');
  let desde = 0;

  for (;;) {
    const inicio = buffer.indexOf(marca, desde);
    if (inicio === -1) break;
    const fin = buffer.indexOf(Buffer.from('endstream'), inicio);
    if (fin === -1) break;
    desde = fin + 1;

    const crudo = buffer.subarray(inicio + marca.length, fin);
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
        texto += Buffer.from(trozo.slice(1, -1), 'hex').toString('latin1');
      }
    }
    texto += '\n';
  }

  return texto;
}

function paginasDePdf(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
