import type { HistogramSettings } from '../presentation/contract';

/**
 * Histograma — como se reparten las observaciones de una medida.
 *
 * Los intervalos se calculan UNA vez, aqui, y los usan tanto el dibujo como el respaldo en DOM.
 * Calculandolos dos veces, la tabla y el grafico terminan diciendo cosas distintas sobre los
 * mismos datos, que es peor que no tener respaldo.
 */

export interface Bin {
  /** Limite inferior, incluido. */
  from: number;
  /** Limite superior. Excluido, salvo en el ultimo, que cierra por la derecha. */
  to: number;
  /** Cuantas observaciones caen dentro. */
  count: number;
}

export interface Histogram {
  bins: Bin[];
  /** Lo que se DIBUJA de cada intervalo, ya acumulado o en porcentaje segun se pida. */
  displayed: number[];
  /** Cuantas observaciones entraron. Es el denominador del porcentaje. */
  total: number;
}

/** Ni un intervalo por observacion, ni tres para mil casos. */
export const MIN_BINS = 1;
export const MAX_BINS = 60;

/**
 * Cuantos intervalos cuando nadie lo dice.
 *
 * Freedman-Diaconis toma la amplitud del recorrido intercuartilico, que no se deja arrastrar por
 * un atipico: en duraciones judiciales, un solo expediente de diez anos pondria a todos los demas
 * en el primer intervalo. Con el recorrido intercuartilico en cero —la mitad de las observaciones
 * en el mismo valor— no hay anchura que sacar, y se cae a Sturges.
 */
export function suggestedBins(sorted: number[]): number {
  const n = sorted.length;
  if (n < 2) return 1;

  const sturges = Math.ceil(Math.log2(n)) + 1;
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  if (iqr <= 0) return clamp(sturges);

  const width = (2 * iqr) / Math.cbrt(n);
  const recorrido = (sorted[n - 1] as number) - (sorted[0] as number);
  if (width <= 0 || recorrido <= 0) return clamp(sturges);

  return clamp(Math.ceil(recorrido / width));
}

const clamp = (n: number) => Math.min(MAX_BINS, Math.max(MIN_BINS, n));

/**
 * El cuantil por interpolacion lineal entre los dos vecinos.
 *
 * Es el metodo que usan R por defecto y las hojas de calculo, y el que hace que la mediana de un
 * numero par de observaciones sea el promedio de las dos centrales en vez de una de ellas.
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

/** Solo los numeros. Un hueco no es un cero: no tiene sitio en ningun intervalo. */
export const numbersOf = (values: (number | null | undefined)[]): number[] =>
  values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

export function histogramOf(
  values: (number | null | undefined)[],
  settings: HistogramSettings = {},
): Histogram {
  const limpios = numbersOf(values);
  if (limpios.length === 0) return { bins: [], displayed: [], total: 0 };

  const sorted = [...limpios].sort((a, b) => a - b);
  const min = sorted[0] as number;
  const max = sorted[sorted.length - 1] as number;

  const pedidos = settings.bins;
  const cuantos =
    pedidos !== undefined && Number.isFinite(pedidos) ? clamp(Math.round(pedidos)) : suggestedBins(sorted);

  /*
   * Todas las observaciones en el mismo valor: un solo intervalo, y su anchura no es cero sino
   * indefinida. Repartir un recorrido de cero entre n intervalos daria n limites identicos y
   * todas las observaciones en el ultimo.
   */
  if (max === min) {
    const bins = [{ from: min, to: min, count: limpios.length }];
    return { bins, displayed: display([limpios.length], limpios.length, settings), total: limpios.length };
  }

  const ancho = (max - min) / cuantos;
  const bins: Bin[] = Array.from({ length: cuantos }, (_, i) => ({
    from: min + i * ancho,
    to: i === cuantos - 1 ? max : min + (i + 1) * ancho,
    count: 0,
  }));

  for (const valor of sorted) {
    // El ultimo intervalo cierra por la derecha: sin esto el maximo caeria fuera de todos.
    const indice = valor === max ? cuantos - 1 : Math.floor((valor - min) / ancho);
    const bin = bins[Math.min(cuantos - 1, Math.max(0, indice))];
    if (bin) bin.count += 1;
  }

  return {
    bins,
    displayed: display(
      bins.map((b) => b.count),
      limpios.length,
      settings,
    ),
    total: limpios.length,
  };
}

/** El recuento crudo convertido en lo que se pidio ver. */
function display(counts: number[], total: number, settings: HistogramSettings): number[] {
  let salida = counts;

  if (settings.cumulative) {
    let hasta = 0;
    salida = counts.map((c) => (hasta += c));
  }
  if (settings.relative) {
    salida = total === 0 ? salida.map(() => 0) : salida.map((c) => (c / total) * 100);
  }
  return salida;
}

/**
 * El rotulo de un intervalo.
 *
 * Lo usan el eje y la tabla del respaldo, para que los dos nombren igual el mismo intervalo.
 */
export function binLabel(bin: Bin, formatear: (n: number) => string): string {
  return bin.from === bin.to
    ? formatear(bin.from)
    : `${formatear(bin.from)} – ${formatear(bin.to)}`;
}

/**
 * Donde cae un valor de la MEDIDA sobre el eje de intervalos.
 *
 * El eje de un histograma es de categorias —un intervalo por banda— y una linea de referencia
 * habla de la medida: «el plazo legal son 180 dias». Traducirla a la posicion que le toca es lo
 * que la deja apuntando a los dias y no al recuento de casos, que es el otro eje y no significa lo
 * mismo. ECharts numera la banda `i` en su centro, asi que su borde izquierdo es `i - 0.5`.
 *
 * Un umbral fuera del recorrido se pega al borde: sigue diciendo algo —que queda mas alla de todo
 * lo dibujado— y quitarlo en silencio dejaria a quien lo configuro creyendo que esta.
 */
export function binPosition(bins: Bin[], valor: number): number {
  if (bins.length === 0) return 0;

  const indice = bins.findIndex((b) => valor >= b.from && valor <= b.to);
  if (indice < 0) return valor < (bins[0] as Bin).from ? -0.5 : bins.length - 0.5;

  const bin = bins[indice] as Bin;
  if (bin.to === bin.from) return indice;
  return indice - 0.5 + (valor - bin.from) / (bin.to - bin.from);
}
