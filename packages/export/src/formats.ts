import type { ExportableDocument } from './document';

/** Formatos de texto: CSV. */

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
