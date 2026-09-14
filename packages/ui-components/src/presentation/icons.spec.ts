import { describe, expect, it } from 'vitest';
import { ICON_STROKES, type IconName } from './icons';

/**
 * Que el trazo de cada icono sea un camino SVG que un navegador entienda entero.
 *
 * El tipo garantiza que el NOMBRE existe, y la prueba del contrato que la cadena no esta vacia.
 * Entre las dos queda el hueco que de verdad importa: que la cadena sea un camino valido. Un `d`
 * mal formado no da error en consola ni rompe el renderizado — el navegador dibuja los comandos
 * que entiende, descarta desde el primero que no, y sigue. El icono sale a medias, y eso solo se
 * ve mirandolo de cerca en la pantalla donde este.
 *
 * Se comprueba la gramatica del atributo, que es pequena y cerrada: una letra de comando seguida
 * de tantos numeros como ese comando pide, repetibles. No se comprueba que el dibujo sea bonito
 * —eso no lo puede decir una prueba— sino que no se pierda por el camino.
 */

/** Cuantos numeros pide cada comando. Es la tabla de la especificacion de SVG, entera. */
const ARIDAD: Record<string, number> = {
  M: 2, // moveto
  L: 2, // lineto
  H: 1, // horizontal
  V: 1, // vertical
  C: 6, // curva cubica
  S: 4, // cubica suave
  Q: 4, // curva cuadratica
  T: 2, // cuadratica suave
  A: 7, // arco
  Z: 0, // cerrar
};

/** Un numero de SVG: admite signo, decimales y notacion exponencial. */
const NUMERO = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

interface Problema {
  icono: string;
  detalle: string;
}

/**
 * Parte el `d` en comandos.
 *
 * Los numeros se separan por comas, espacios o por nada: `M4 7h16` y `M4,7 h16` son lo mismo, y
 * `.5.5` son DOS numeros. Por eso no vale un `split` por espacios.
 */
function comandos(d: string): { letra: string; numeros: string[] }[] {
  const trozos: { letra: string; numeros: string[] }[] = [];
  for (const m of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const numeros = (m[2] as string).match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
    trozos.push({ letra: m[1] as string, numeros });
  }
  return trozos;
}

function revisar(nombre: string, d: string): Problema[] {
  const problemas: Problema[] = [];
  const trozos = comandos(d);

  if (trozos.length === 0) {
    return [{ icono: nombre, detalle: 'no tiene ningun comando' }];
  }

  // Un camino que no empieza moviendo el lapiz no dibuja nada: el navegador lo descarta entero.
  const primera = trozos[0]?.letra.toUpperCase();
  if (primera !== 'M') {
    problemas.push({ icono: nombre, detalle: `empieza por '${trozos[0]?.letra}' y no por 'M'` });
  }

  // Lo que el regex de comandos no se lleva es lo que sobra: letras sueltas o basura entre medias.
  const reconstruido = trozos.map((c) => c.letra + c.numeros.join(' ')).join('');
  const sinSeparadores = (s: string) => s.replace(/[\s,]/g, '');
  if (sinSeparadores(reconstruido).length !== sinSeparadores(d).length) {
    problemas.push({ icono: nombre, detalle: 'lleva caracteres que no son comando ni numero' });
  }

  for (const { letra, numeros } of trozos) {
    const aridad = ARIDAD[letra.toUpperCase()];
    if (aridad === undefined) {
      problemas.push({ icono: nombre, detalle: `'${letra}' no es un comando de SVG` });
      continue;
    }

    for (const n of numeros) {
      if (!NUMERO.test(n)) {
        problemas.push({ icono: nombre, detalle: `'${n}' no es un numero valido (en '${letra}')` });
      }
    }

    if (aridad === 0) {
      if (numeros.length > 0) {
        problemas.push({ icono: nombre, detalle: `'${letra}' no lleva numeros y tiene ${numeros.length}` });
      }
      continue;
    }

    // Un comando admite sus numeros REPETIDOS —`L1 2 3 4` son dos lineas— pero nunca a medias.
    if (numeros.length === 0 || numeros.length % aridad !== 0) {
      problemas.push({
        icono: nombre,
        detalle: `'${letra}' pide multiplos de ${aridad} numeros y tiene ${numeros.length}`,
      });
    }

    // El arco lleva dos banderas que solo pueden ser 0 o 1. Un 2 ahi lo descarta el navegador.
    if (letra.toUpperCase() === 'A') {
      for (let i = 0; i < numeros.length; i += 7) {
        for (const pos of [i + 3, i + 4]) {
          const bandera = numeros[pos];
          if (bandera !== undefined && bandera !== '0' && bandera !== '1') {
            problemas.push({
              icono: nombre,
              detalle: `el arco lleva una bandera '${bandera}', y solo admite 0 o 1`,
            });
          }
        }
      }
    }
  }

  return problemas;
}

describe('el trazo de cada icono', () => {
  const entradas = Object.entries(ICON_STROKES) as [IconName, string][];

  it('hay iconos que revisar', () => {
    expect(entradas.length).toBeGreaterThan(30);
  });

  it('es un camino SVG que se dibuja entero', () => {
    const problemas = entradas.flatMap(([nombre, d]) => revisar(nombre, d));
    expect(problemas.map((p) => `${p.icono}: ${p.detalle}`).sort()).toEqual([]);
  });

  /*
   * La comprobacion tiene que RECHAZAR algo, o no comprueba nada.
   *
   * Una validacion escrita a mano que acepta todo lo que se le pone delante es indistinguible de
   * un `return true`, y se nota el dia que hace falta. Estos son los cuatro fallos reales que un
   * `d` puede tener, y el navegador se come los cuatro en silencio.
   */
  it.each([
    ['h16M4 12', "empieza por 'h' y no por 'M'"],
    ['M4 7h16 #', 'un caracter que no es comando ni numero'],
    ['M4 7 12', 'a M le sobra un numero'],
    ['M4 7Q1 2 3', 'a Q le faltan numeros'],
    // Las banderas del arco son la CUARTA y la QUINTA cifra. La tercera es la rotacion, que
    // admite cualquier numero: escribir el caso mal es tan facil como escribir el arco mal.
    ['M4 7a5 5 0 2 1 10 0', 'la bandera de arco grande vale 2, y solo admite 0 o 1'],
    ['M4 7k16', "'k' no es un comando de SVG"],
  ])('rechaza %s (%s)', (d) => {
    expect(revisar('prueba', d).length).toBeGreaterThan(0);
  });
});
