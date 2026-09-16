import { LABEL_SEPARATOR, type CategoricalViewModel } from '../registry/viewModel';

/** Pequenos multiplos — el mismo grafico, una vez por cada valor de una dimension. */

/** Cuantos paneles se dibujan como maximo. */
export const MAX_PANELS = 12;

export interface MultiplePanel {
  /** El valor de la dimension que reparte: el titulo de este panel. */
  titulo: string;
  vm: CategoricalViewModel;
}

/** Parte un modelo de vista de DOS dimensiones en uno por cada valor de la primera. */
export interface MultiplePartition {
  panels: MultiplePanel[];
  /** Cuantos quedaron fuera del limite. */
  omitted: number;
}

export function splitMultiples(vm: CategoricalViewModel): MultiplePartition {
  const panels = new Map<string, CategoricalViewModel>();

  for (const punto of vm.points) {
    const corte = punto.label.indexOf(LABEL_SEPARATOR);
    if (corte < 0) continue;
    const titulo = punto.label.slice(0, corte);
    const categoria = punto.label.slice(corte + LABEL_SEPARATOR.length);

    const panel = panels.get(titulo) ?? { series: vm.series, points: [], aggregated: vm.aggregated };
    panel.points.push({ label: categoria, values: punto.values });
    panels.set(titulo, panel);
  }

  if (panels.size === 0) return { panels: [{ titulo: '', vm }], omitted: 0 };

  /*
   * Se quedan los PRIMEROS del orden vigente, no los doce mayores.
   */
  const all = [...panels.entries()].map(([titulo, panel]) => ({ titulo, vm: panel }));
  return {
    panels: all.slice(0, MAX_PANELS),
    omitted: Math.max(0, all.length - MAX_PANELS),
  };
}

/** El maximo de TODOS los paneles, para fijarles una escala comun. */
export function maxCommon(panels: MultiplePanel[]): number | undefined {
  const valores = panels.flatMap((p) =>
    p.vm.points.flatMap((punto) => punto.values.filter((v): v is number => v !== null)),
  );
  if (valores.length === 0) return undefined;
  return Math.max(...valores);
}

/** Cuantas columnas usar para `n` paneles. */
export function columnsFor(n: number, pedidas?: number): number {
  if (pedidas !== undefined && pedidas > 0) return Math.min(pedidas, 4);
  return Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
}
