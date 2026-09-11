import type { DocumentoExportable, HojaExportable } from './documento';

/**
 * Formatos de texto: CSV y SVG.
 *
 * Los dos parten del mismo `DocumentoExportable` y no deciden nada sobre su contenido: solo
 * COMO se dibuja. Van aparte de los binarios porque no necesitan ninguna libreria de Node.
 */

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
    for (const fila of hoja.rows) {
      lineas.push(fila.map(escaparCsv).join(','));
    }
    lineas.push('');
  }

  return `\uFEFF${lineas.join('\r\n')}`;
}

const escaparXml = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * SVG de un grafico de barras.
 *
 * Se exporta VECTOR y no PNG a proposito: rasterizar exigiria un navegador o una libreria de
 * imagen en el servidor, y un SVG se abre en cualquier navegador, se incrusta en un documento y
 * escala sin perder nitidez. Si mas adelante hace falta PNG, se rasteriza desde aqui.
 *
 * Dibuja `documento.grafico`, que es el primer objeto MARCADO como grafico. Si el modulo no
 * tiene ninguno, cae en la primera hoja: es mejor una imagen pobre que un archivo vacio, y el
 * encabezado dice de que objeto sale.
 *
 * Los colores salen de `documento.paleta`, que viene del tema institucional. Antes estaban
 * escritos a mano aqui, y una imagen exportada con otra paleta que la pantalla rompe la marca en
 * el sitio donde mas circula.
 */
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
  const maximo = Math.max(1, ...valores);

  const anchoBarra = 40;
  const separacion = 16;
  const margenIzq = 60;
  const margenSup = 40 + encabezado.lineas.length * 14;
  const altoGrafico = 220;
  const ancho = Math.max(400, margenIzq + filas.length * (anchoBarra + separacion) + 40);
  const alto = margenSup + altoGrafico + 80;

  const barras = filas
    .map((fila, i) => {
      const valor = valores[i] ?? 0;
      const altoBarra = (valor / maximo) * altoGrafico;
      const x = margenIzq + i * (anchoBarra + separacion);
      const y = margenSup + altoGrafico - altoBarra;
      const color = paleta.series[i % paleta.series.length] ?? paleta.texto;
      return [
        `<rect x="${x}" y="${y.toFixed(1)}" width="${anchoBarra}" height="${altoBarra.toFixed(1)}" fill="${color}" />`,
        `<text x="${x + anchoBarra / 2}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="${paleta.texto}">${valor}</text>`,
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
    '</svg>',
  ].join('');
}
