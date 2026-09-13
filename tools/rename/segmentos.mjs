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
 * Reconoce comentarios de linea y de bloque, comillas simples, dobles y plantillas —con sus
 * interpolaciones, que vuelven a ser codigo—, el escape con barra invertida y las EXPRESIONES
 * REGULARES, que cuentan como cadena.
 *
 * Las expresiones regulares hacen falta: una prueba comprueba un mensaje con
 * `/no existen en el esquema activo/`, y tratando eso como codigo el renombrado convirtio
 * `esquema` en `scheme` dentro de la afirmacion, que paso a comprobar un texto que el servidor
 * nunca dice. Distinguir una expresion regular de una division es el caso ambiguo clasico de
 * JavaScript; se resuelve con la heuristica de siempre: tras `( , = : [ ! & | ? { } ;` o al
 * principio de una linea, una barra abre expresion regular.
 */

/** @typedef {{ tipo: 'codigo' | 'comentario' | 'cadena', texto: string }} Segmento */

const ANTES_DE_EXPRESION = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';']);

/** Si la barra en `i` abre una expresion regular y no es una division. */
function abreExpresion(fuente, i) {
  for (let j = i - 1; j >= 0; j--) {
    const c = fuente[j];
    if (c === ' ' || c === '\t') continue;
    if (c === '\n') return true;
    return ANTES_DE_EXPRESION.has(c);
  }
  return true;
}

/** El indice de la barra que cierra la expresion regular abierta en `i`, o -1. */
function finDeExpresion(fuente, i) {
  let enClase = false;
  for (let j = i + 1; j < fuente.length; j++) {
    const c = fuente[j];
    if (c === '\\') { j++; continue; }
    if (c === '\n') return -1;
    if (c === '[') enClase = true;
    else if (c === ']') enClase = false;
    else if (c === '/' && !enClase) {
      let k = j + 1;
      while (k < fuente.length && /[dgimsuvy]/.test(fuente[k])) k++;
      return k - 1;
    }
  }
  return -1;
}

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
      if (fuente[i] === '/' && abreExpresion(fuente, i)) {
        const fin = finDeExpresion(fuente, i);
        if (fin !== -1) {
          cerrar(i, 'cadena');
          i = fin + 1;
          cerrar(i, 'codigo');
          continue;
        }
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
