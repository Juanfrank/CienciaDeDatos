import { LABEL_SEPARATOR, type CategoricalViewModel } from '../registry/viewModel';
import type { BoxplotSettings } from '../presentation/contract';
import { fiveNumberOf, type FiveNumber } from './statistics';

/**
 * Diagrama de caja — comparar la FORMA de una medida entre grupos.
 *
 * Lo que el histograma ensena de una distribucion, esto lo compara entre muchas: la duracion de los
 * casos por distrito o por materia, cada uno con su mediana, sus cuartiles y lo que se le sale.
 *
 * Las cajas se calculan aqui, una sola vez, y de ellas leen el dibujo Y el respaldo en DOM.
 */

export interface Box extends FiveNumber {
  /** El valor del grupo: lo que rotula la caja. */
  label: string;
}

/**
 * Las observaciones de cada grupo, a partir de un modelo de DOS dimensiones.
 *
 * `toCategorical` compone las etiquetas —«Distrito Norte / caso-12»—, asi que el grupo es lo que va
 * antes del separador. Con una sola dimension no hay grupo que separar y todas las observaciones
 * caen en una unica caja, que es la lectura correcta: la distribucion del conjunto.
 */
export function groupsOf(vm: CategoricalViewModel): { label: string; values: (number | null)[] }[] {
  const grupos = new Map<string, (number | null)[]>();

  for (const punto of vm.points) {
    const corte = punto.label.indexOf(LABEL_SEPARATOR);
    const grupo = corte < 0 ? '' : punto.label.slice(0, corte);
    const valores = grupos.get(grupo) ?? [];
    valores.push(punto.values[0] ?? null);
    grupos.set(grupo, valores);
  }

  return [...grupos.entries()].map(([label, values]) => ({ label, values }));
}

/**
 * Una caja por grupo.
 *
 * Un grupo sin ninguna observacion numerica NO da una caja plana en cero: se queda fuera. Dibujarlo
 * diria que ese distrito resuelve todo en cero dias, que es justo lo contrario de «no se sabe».
 */
export function boxesOf(vm: CategoricalViewModel, settings: BoxplotSettings = {}): Box[] {
  const cajas: Box[] = [];

  for (const { label, values } of groupsOf(vm)) {
    const resumen = fiveNumberOf(values, settings.whiskers ?? 'tukey');
    if (resumen) cajas.push({ label, ...resumen });
  }

  return cajas;
}
