/**
 * Los resumenes estadisticos que comparten varios objetos.
 *
 * Viven aparte porque los usan el histograma y el diagrama de caja, y ninguno de los dos es su
 * dueno: dejarlos en uno obligaria al otro a importar de un modulo que no le corresponde, o —lo
 * que de verdad pasa— a escribir su propia copia, que es como dos objetos acaban discrepando sobre
 * la mediana del mismo dato.
 */

/** Solo los numeros. Un hueco no es un cero: no es una observacion. */
export const numbersOf = (values: (number | null | undefined)[]): number[] =>
  values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

/**
 * El cuantil por interpolacion lineal entre los dos vecinos.
 *
 * Es el metodo que usan R por defecto y las hojas de calculo, y el que hace que la mediana de un
 * numero par de observaciones sea el promedio de las dos centrales en vez de una de ellas.
 *
 * Recibe la lista YA ORDENADA: ordenar aqui escondería un coste de n log n dentro de algo que se
 * llama cinco veces seguidas sobre el mismo grupo.
 */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] as number;

  const posicion = (sorted.length - 1) * q;
  const bajo = Math.floor(posicion);
  const alto = Math.ceil(posicion);
  const valorBajo = sorted[bajo] as number;
  if (bajo === alto) return valorBajo;
  return valorBajo + (posicion - bajo) * ((sorted[alto] as number) - valorBajo);
}

/** Hasta donde llegan los bigotes. */
export const WHISKER_RULES = ['tukey', 'extremos'] as const;
export type WhiskerRule = (typeof WHISKER_RULES)[number];

/** El resumen de cinco numeros, mas lo que queda fuera. */
export interface FiveNumber {
  low: number;
  q1: number;
  median: number;
  q3: number;
  high: number;
  /** Las observaciones mas alla de los bigotes. Vacio con la regla de los extremos. */
  outliers: number[];
  mean: number;
  count: number;
}

/**
 * El factor de Tukey. 1,5 no es un ajuste: es la convencion con la que se lee un diagrama de caja
 * en cualquier sitio, y cambiarla haria que dos informes de la misma institucion llamaran atipico
 * a cosas distintas.
 */
const TUKEY = 1.5;

export function fiveNumberOf(
  values: (number | null | undefined)[],
  whiskers: WhiskerRule = 'tukey',
): FiveNumber | null {
  const sorted = numbersOf(values).sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const mean = sorted.reduce((suma, v) => suma + v, 0) / sorted.length;
  const minimo = sorted[0] as number;
  const maximo = sorted[sorted.length - 1] as number;

  if (whiskers === 'extremos') {
    return { low: minimo, q1, median, q3, high: maximo, outliers: [], mean, count: sorted.length };
  }

  /*
   * Los bigotes llegan hasta la observacion mas alejada que TODAVIA esta dentro de vez y media el
   * recorrido intercuartilico, no hasta el limite calculado: un bigote que termina donde no hay
   * ningun dato dibuja un alcance que nadie midio.
   */
  const iqr = q3 - q1;
  const suelo = q1 - TUKEY * iqr;
  const techo = q3 + TUKEY * iqr;
  const dentro = sorted.filter((v) => v >= suelo && v <= techo);

  return {
    low: dentro[0] ?? minimo,
    q1,
    median,
    q3,
    high: dentro[dentro.length - 1] ?? maximo,
    outliers: sorted.filter((v) => v < suelo || v > techo),
    mean,
    count: sorted.length,
  };
}
