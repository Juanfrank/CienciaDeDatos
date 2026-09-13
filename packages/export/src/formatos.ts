import { textoDeCelda, type DocumentoExportable, type HojaExportable } from './documento';

/** Formatos de texto: CSV y SVG. */

/** Escapa un valor para CSV segun RFC 4180. */
export function escaparCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV. */
export function aCsv(documento: DocumentoExportable): string {
  const { encabezado, hojas } = documento;
  const lineas: string[] = [
    `# ${encabezado.titulo}`,
    ...encabezado.lineas.map((l) => `# ${l}`),
    '',
  ];

  for (const hoja of hojas) {
    if (hojas.length > 1) lineas.push(`# ${hoja.title}`);
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
export function aSvg(documento: DocumentoExportable): string {
  const hoja: HojaExportable | undefined = documento.grafico ?? documento.hojas[0];
  const { encabezado, paleta } = documento;

  if (!hoja) throw new Error('No hay ningun objeto con datos que dibujar.');

  const indiceValor = Math.max(
    0,
    hoja.columns.findIndex((c) => c.type === 'number'),
  );
  const filas = hoja.rows.slice(0, 20);
  const valores = filas.map((f) => Number(f[indiceValor]) || 0);
  // La cifra sobre la barra, con el formato de la pantalla. Lo demas ya se hizo en el lienzo:
  // aqui pasaba lo mismo que pasaba alli, y por el mismo motivo — nadie habia pasado el formato.
  const textos = filas.map((_, i) => textoDeCelda(hoja, i, indiceValor));
  const maximo = Math.max(1, ...valores);

  const anchoBarra = 40;
  const separacion = 16;
  const margenIzq = 60;
  const margenSup = 40 + encabezado.lineas.length * 14;
  const altoGrafico = 220;
  const ancho = Math.max(400, margenIzq + filas.length * (anchoBarra + separacion) + 40);
  const notas = hoja.notas ?? [];
  // Se reserva alto para las notas: escritas sobre el area de dibujo taparian las barras, y
  // fuera del `viewBox` no se verian en absoluto.
  const alto = margenSup + altoGrafico + 80 + notas.length * 14;

  const barras = filas
    .map((fila, i) => {
      const valor = valores[i] ?? 0;
      const altoBarra = (valor / maximo) * altoGrafico;
      const x = margenIzq + i * (anchoBarra + separacion);
      const y = margenSup + altoGrafico - altoBarra;
      const color = paleta.series[i % paleta.series.length] ?? paleta.texto;
      return [
        `<rect x="${x}" y="${y.toFixed(1)}" width="${anchoBarra}" height="${altoBarra.toFixed(1)}" fill="${color}" />`,
        `<text x="${x + anchoBarra / 2}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="${paleta.texto}">${escaparXml(textos[i] ?? String(valor))}</text>`,
        `<text x="${x + anchoBarra / 2}" y="${margenSup + altoGrafico + 16}" text-anchor="middle" font-size="10" fill="${paleta.textoAtenuado}">${escaparXml(String(fila[0] ?? ''))}</text>`,
      ].join('');
    })
    .join('');

  const metadatos = encabezado.lineas
    .map(
      (l, i) =>
        `<text x="16" y="${38 + i * 14}" font-size="10" fill="${paleta.textoAtenuado}">${escaparXml(l)}</text>`,
    )
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${escaparXml(hoja.title)}">`,
    `<rect width="${ancho}" height="${alto}" fill="${paleta.superficie}" />`,
    `<text x="16" y="22" font-size="14" font-weight="bold" fill="${paleta.texto}">${escaparXml(encabezado.titulo)} — ${escaparXml(hoja.title)}</text>`,
    metadatos,
    `<line x1="${margenIzq - 8}" y1="${margenSup + altoGrafico}" x2="${ancho - 20}" y2="${margenSup + altoGrafico}" stroke="${paleta.borde}" />`,
    barras,
    ...notas.map(
      (nota, i) =>
        `<text x="16" y="${margenSup + altoGrafico + 60 + i * 14}" font-size="10" fill="${paleta.textoAtenuado}">${escaparXml(nota)}</text>`,
    ),
    '</svg>',
  ].join('');
}
