/**
 * Formateo de mensajes en sintaxis ICU MessageFormat, en el subconjunto que esta aplicacion usa:
 * interpolacion `{nombre}`, numero `{n, number}`, plural `{n, plural, ...}` y `{x, select, ...}`.
 *
 * Se implementa aqui en vez de traer una libreria porque el subconjunto es pequeno y lo que
 * importa es el FORMATO: los catalogos son ICU estandar y se entregan tal cual a cualquier
 * herramienta de traduccion, hoy o el dia que se cambie de implementacion.
 *
 * Los plurales los resuelve `Intl.PluralRules` y no una comparacion con 1. El espanol y el ingles
 * tienen dos categorias, pero el arabe tiene seis y el polaco cuatro: escribir la regla a mano es
 * lo que obliga a rehacer el catalogo entero cuando entra el tercer idioma.
 */

export type MessageParameters = Record<string, string | number>;

/** Un `{...}` de nivel superior dentro de `texto`, a partir de `desde`. */
function argumento(content: string, desde: number): { inicio: number; fin: number } | null {
  const inicio = content.indexOf('{', desde);
  if (inicio === -1) return null;
  let profundidad = 0;
  for (let i = inicio; i < content.length; i++) {
    if (content[i] === '{') profundidad++;
    else if (content[i] === '}' && --profundidad === 0) return { inicio, fin: i };
  }
  return null;
}

/** Las opciones `=0 {...} one {...} other {...}` de un argumento plural o select. */
function opciones(body: string): Map<string, string> {
  const mapa = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const clave = /^\s*(=?[a-zA-Z0-9_]+)\s*(?=\{)/.exec(body.slice(i));
    if (!clave) break;
    const block = argumento(body, i + clave[0].length);
    if (!block) break;
    mapa.set(clave[1] as string, body.slice(block.inicio + 1, block.fin));
    i = block.fin + 1;
  }
  return mapa;
}

/**
 * Sustituye los argumentos de un mensaje.
 *
 * Un argumento sin valor se deja escrito entre llaves en vez de convertirse en `undefined`: una
 * cadena con `{total}` a la vista dice que falta un parametro, y `undefined` en mitad de una
 * frase parece un dato.
 */
export function formatMessage(
  mensaje: string,
  parameters: MessageParameters = {},
  locale = 'es',
): string {
  let salida = '';
  let cursor = 0;

  for (;;) {
    const block = argumento(mensaje, cursor);
    if (!block) {
      salida += mensaje.slice(cursor);
      return salida;
    }

    salida += mensaje.slice(cursor, block.inicio);
    const interior = mensaje.slice(block.inicio + 1, block.fin);
    const [crudo = '', tipo, ...resto] = interior.split(',');
    const nombre = crudo.trim();
    const valor = parameters[nombre];

    if (valor === undefined) {
      salida += mensaje.slice(block.inicio, block.fin + 1);
    } else if (tipo === undefined) {
      salida += String(valor);
    } else {
      const clase = tipo.trim();
      const body = resto.join(',');
      if (clase === 'number') {
        salida += new Intl.NumberFormat(locale).format(Number(valor));
      } else if (clase === 'plural') {
        const casos = opciones(body);
        const n = Number(valor);
        const categoria = new Intl.PluralRules(locale).select(n);
        const chosen = casos.get(`=${n}`) ?? casos.get(categoria) ?? casos.get('other') ?? '';
        salida += formatMessage(chosen.replaceAll('#', String(n)), parameters, locale);
      } else if (clase === 'select') {
        const casos = opciones(body);
        const chosen = casos.get(String(valor)) ?? casos.get('other') ?? '';
        salida += formatMessage(chosen, parameters, locale);
      } else {
        salida += String(valor);
      }
    }

    cursor = block.fin + 1;
  }
}
