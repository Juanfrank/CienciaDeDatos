/*
 * Parte un archivo TypeScript en zonas: codigo, comentario y cadena.
 *
 * Sin esta separacion, un renombrado por palabra completa es indistinguible de un desastre: la
 * palabra `texto` es una variable en cuatro sitios y aparece en trescientos comentarios en
 * espanol, y sustituirla en todos convierte la prosa en una mezcla sin sentido.
 *
 * Con las zonas separadas se puede aplicar una regla distinta a cada una:
 *   codigo      todos los identificadores
 *   comentario  solo los compuestos, que no se confunden con prosa
 *   cadena      solo lo que es un contrato de interfaz: testids y clases CSS
 *
 * El escaner es lo bastante fiel para este uso: reconoce comentarios de linea y de bloque,
 * comillas simples, dobles y plantillas —con sus interpolaciones, que vuelven a ser codigo— y
 * el escape con barra invertida. No distingue una expresion regular de una division, que es el
 * caso ambiguo clasico; no importa aqui, porque dentro de una expresion regular no hay
 * identificadores que renombrar.
 */

/** @typedef {{ tipo: 'codigo' | 'comentario' | 'cadena', texto: string }} Segmento */

/** @returns {Segmento[]} */
export function segmentar(fuente) {
  /** @type {Segmento[]} */
  const salida = [];
  let modo = 'codigo';
  let inicio = 0;
  let i = 0;
  /** Profundidad de `${...}` dentro de plantillas, para volver a cadena al cerrar. */
  const plantillas = [];
  let comilla = '';

  const cerrar = (hasta, nuevoModo) => {
    if (hasta > inicio) salida.push({ tipo: modo, texto: fuente.slice(inicio, hasta) });
    inicio = hasta;
    modo = nuevoModo;
  };

  while (i < fuente.length) {
    const dos = fuente.slice(i, i + 2);

    if (modo === 'codigo') {
      if (dos === '//') {
        cerrar(i, 'comentario');
        i = fuente.indexOf('\n', i);
        if (i === -1) i = fuente.length;
        cerrar(i, 'codigo');
        continue;
      }
      if (dos === '/*') {
        cerrar(i, 'comentario');
        const fin = fuente.indexOf('*/', i + 2);
        i = fin === -1 ? fuente.length : fin + 2;
        cerrar(i, 'codigo');
        continue;
      }
      if (fuente[i] === "'" || fuente[i] === '"' || fuente[i] === '`') {
        comilla = fuente[i];
        cerrar(i, 'cadena');
        i += 1;
        continue;
      }
      if (fuente[i] === '}' && plantillas.length > 0) {
        // Se cierra una interpolacion: se vuelve a la plantilla que la contenia.
        comilla = '`';
        plantillas.pop();
        cerrar(i, 'cadena');
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    // Dentro de una cadena.
    if (fuente[i] === '\\') {
      i += 2;
      continue;
    }
    if (comilla === '`' && dos === '${') {
      i += 2;
      cerrar(i, 'codigo');
      plantillas.push(true);
      continue;
    }
    if (fuente[i] === comilla) {
      i += 1;
      cerrar(i, 'codigo');
      continue;
    }
    i += 1;
  }

  cerrar(fuente.length, modo);
  return salida;
}

/** Vuelve a unir los segmentos. `unir(segmentar(x)) === x` para cualquier `x`. */
export const unir = (segmentos) => segmentos.map((s) => s.texto).join('');
