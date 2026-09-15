import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Una asercion que puede no ejecutarse nunca — apartado 2.14.
 *
 * Es la guarda que faltaba para la clase de fallo que dejo la prueba del registro de auditoria en
 * verde desde el dia que se escribio. Decia comprobar que la columna «quien» no muestra
 * identificadores crudos, seleccionaba `.log__row` —que no existe: la tabla es `tabla` y sus filas
 * son `tr`— y metia su unica asercion dentro de `if (filas.count() > 0)`. Cero filas, condicion
 * falsa, ninguna asercion, verde. Y con eso tapaba que las dos pantallas mostraban `u-admin`
 * donde deberia ir un nombre.
 *
 * El problema de fondo no es el selector, que ya lo ata `interfaz.spec.ts`. Es la FORMA:
 *
 *     if (algo) { expect(...) }        // si `algo` es falso, la prueba no comprueba nada
 *
 * y una prueba que no comprueba nada no se distingue de una que pasa. Es peor que no tenerla: una
 * que falta se ve en la lista, y esta ocupa su sitio y da confianza.
 *
 * LO QUE SI ESTA BIEN, y por eso la guarda mira el `expect` y no el `if`: recoger en un bucle con
 * condiciones y afirmar DESPUES, fuera de toda rama.
 *
 *     for (const x of todos) if (malo(x)) problemas.push(x);
 *     expect(problemas).toEqual([]);   // se ejecuta siempre, pase lo que pase
 *
 * Es el patron de media carpeta `tools/coherence` y de `icons.spec.ts`, y no lo toca.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

const pruebas = listar("'*.spec.ts' '*.spec.tsx'");

/**
 * La marca que declara una rama legitima, con su motivo OBLIGATORIO.
 *
 *     // rama-declarada: solo algunas claves traen interruptor; el `expect` de fuera corre igual
 *     if (interruptor) { … expect(…) … }
 *
 * Hay condiciones que no son «quiza no comprueba nada» sino una RAMA de verdad: el caso recorre
 * varios objetos y algunos tienen un paso mas, y la prueba sigue afirmando fuera de la rama pase
 * lo que pase. Sin una forma de decirlo, la guarda obligaria a retorcer esas pruebas o —peor— a
 * que alguien la relaje para todos.
 *
 * Va en la LINEA, no en una lista aparte, por dos razones: se lee junto a lo que excusa, y se
 * mueve con el codigo en vez de quedarse apuntando a una linea que ya es otra cosa. Y exige
 * motivo: una excepcion sin motivo es una excepcion que nadie puede revisar.
 */
const MARCA = /\/\/\s*rama-declarada:\s*\S/;

/**
 * Los `expect(` que quedan dentro de un `if`.
 *
 * Se recorre el archivo carácter a carácter llevando la cuenta de en cuantos `if` estamos
 * metidos. Con una expresion regular no se puede: hace falta saber DONDE cierra cada bloque, y
 * eso es contar llaves.
 *
 * Se ignora lo que hay dentro de una cadena o un comentario, porque esta misma guarda —y varias
 * pruebas— escriben `if` y `expect` dentro de comillas para explicarse.
 */
function aserciónCondicionalEn(fuente: string): number[] {
  const lineas: number[] = [];
  const texto = fuente.split('\n');
  /** La pila de bloques abiertos: la linea del `if` que lo abrio, o `null` si no lo es. */
  const bloques: (number | null)[] = [];
  let linea = 1;
  let ifPendiente: number | null = null;

  for (let i = 0; i < fuente.length; i += 1) {
    const c = fuente[i];
    if (c === '\n') {
      linea += 1;
      continue;
    }

    const salto = saltarLoQueNoEsCodigo(fuente, i);
    if (salto > i) {
      linea += contar(fuente.slice(i, salto), '\n');
      i = salto - 1;
      continue;
    }

    if (fuente.startsWith('if', i) && !/[\w$]/.test(fuente[i - 1] ?? '') && !/[\w$]/.test(fuente[i + 2] ?? '')) {
      ifPendiente = linea;
      continue;
    }
    if (c === '{') {
      bloques.push(ifPendiente);
      ifPendiente = null;
      continue;
    }
    if (c === '}') {
      bloques.pop();
      continue;
    }
    // `(` que no abre un bloque no cambia nada; lo unico que importa es si `if` sigue pendiente
    // cuando llega la llave. Un `if (x) return;` sin llaves no puede contener un `expect`.
    if (c === ';') ifPendiente = null;

    if (fuente.startsWith('expect(', i)) {
      const dentroDeIf = bloques.filter((l): l is number => l !== null);
      // Declarada si la marca esta en la linea del `if` que la envuelve, o en la de arriba.
      const declarada = dentroDeIf.some((l) =>
        [texto[l - 1], texto[l - 2]].some((t) => t !== undefined && MARCA.test(t)),
      );
      if (dentroDeIf.length > 0 && !declarada) lineas.push(linea);
      i += 'expect('.length - 1;
    }
  }

  return lineas;
}

/** Donde termina la cadena, plantilla, expresion regular o comentario que empieza en `i`. */
function saltarLoQueNoEsCodigo(fuente: string, i: number): number {
  const c = fuente[i];
  if (c === '/' && fuente[i + 1] === '/') {
    const fin = fuente.indexOf('\n', i);
    return fin === -1 ? fuente.length : fin;
  }
  if (c === '/' && fuente[i + 1] === '*') {
    const fin = fuente.indexOf('*/', i + 2);
    return fin === -1 ? fuente.length : fin + 2;
  }
  if (c === "'" || c === '"' || c === '`') {
    for (let j = i + 1; j < fuente.length; j += 1) {
      if (fuente[j] === '\\') {
        j += 1;
        continue;
      }
      if (fuente[j] === c) return j + 1;
      // Una cadena con comillas simples o dobles no cruza de linea; una plantilla si.
      if (c !== '`' && fuente[j] === '\n') return j;
    }
    return fuente.length;
  }
  return i;
}

const contar = (texto: string, c: string): number => texto.split(c).length - 1;

/**
 * Los archivos que todavia la tienen, con el motivo.
 *
 * Vacio, y es lo que se quiere: esta nace en CERO porque al medir no habia ninguna. La del
 * registro de auditoria —la que motivo todo esto— ya se arreglo cuando se encontro. Empezar en
 * cero convierte esto en una puerta desde el primer dia en vez de en una deuda que alguien tiene
 * que ir bajando.
 */
const PERMITIDAS: string[] = [];

describe('ninguna asercion vive dentro de un `if` (2.14)', () => {
  it('hay pruebas que revisar', () => {
    expect(pruebas.length).toBeGreaterThan(40);
  });

  it('un `expect` que puede no ejecutarse nunca no se distingue de uno que pasa', () => {
    const culpables: string[] = [];

    for (const ruta of pruebas) {
      if (PERMITIDAS.includes(ruta)) continue;
      for (const linea of aserciónCondicionalEn(readFileSync(`${raiz}/${ruta}`, 'utf8'))) {
        culpables.push(`${ruta}:${linea}`);
      }
    }

    expect(
      culpables,
      'un `expect` dentro de un `if` no comprueba nada cuando la condicion es falsa.\n' +
        'Lo correcto es recoger en el bucle y afirmar DESPUES, fuera de toda rama:\n' +
        '  for (const x of todos) if (malo(x)) problemas.push(x);\n' +
        '  expect(problemas).toEqual([]);\n',
    ).toEqual([]);
  });
});

/** El lector, con los casos que lo hacen util o inutil. */
describe('el lector distingue la forma mala de la buena', () => {
  it('caza el `expect` metido en un `if`', () => {
    expect(aserciónCondicionalEn('it("x", () => { if (filas > 0) { expect(1).toBe(1); } });'))
      .toHaveLength(1);
  });

  it('y tambien el que esta dos bloques mas adentro', () => {
    const fuente = 'if (a) { for (const x of y) { expect(x).toBe(1); } }';
    expect(aserciónCondicionalEn(fuente)).toHaveLength(1);
  });

  it('NO caza recoger en el `if` y afirmar despues', () => {
    // El patron sano, y el que usa media carpeta `tools/coherence`.
    const fuente = 'for (const x of t) { if (malo(x)) problemas.push(x); }\nexpect(problemas).toEqual([]);';
    expect(aserciónCondicionalEn(fuente)).toEqual([]);
  });

  it('NO caza un `expect` dentro de un bucle, que se ejecuta por cada elemento', () => {
    expect(aserciónCondicionalEn('for (const x of t) { expect(x).toBe(1); }')).toEqual([]);
  });

  it('ni se cree un `if` escrito dentro de una cadena o un comentario', () => {
    // Esta misma guarda los escribe para explicarse; sin esto se acusaria a si misma.
    const fuente = '// if (x) { expect(1) }\nconst s = "if (x) { expect(2) }";\nexpect(3).toBe(3);';
    expect(aserciónCondicionalEn(fuente)).toEqual([]);
  });

  it('ni confunde una palabra que acaba en «if»', () => {
    expect(aserciónCondicionalEn('const motif = {}; expect(motif).toEqual({});')).toEqual([]);
  });
});
