import type { CategoricalViewModel } from '../registry/viewModel';

/** Pequenos multiplos — el mismo grafico, una vez por cada valor de una dimension. */

/** Separador con el que `toCategorical` compone las etiquetas de varias dimensiones. */
const SEPARADOR = ' / ';

/** Cuantos paneles se dibujan como maximo. */
export const MAX_PANELES = 12;

export interface PanelDeMultiplo {
  /** El valor de la dimension que reparte: el titulo de este panel. */
  titulo: string;
  vm: CategoricalViewModel;
}

/** Parte un modelo de vista de DOS dimensiones en uno por cada valor de la primera. */
export interface ParticionEnMultiplos {
  paneles: PanelDeMultiplo[];
  /** Cuantos quedaron fuera del limite. */
  omitidos: number;
}

export function partirEnMultiplos(vm: CategoricalViewModel): ParticionEnMultiplos {
  const paneles = new Map<string, CategoricalViewModel>();

  for (const punto of vm.points) {
    const corte = punto.label.indexOf(SEPARADOR);
    if (corte < 0) continue;
    const titulo = punto.label.slice(0, corte);
    const categoria = punto.label.slice(corte + SEPARADOR.length);

    const panel = paneles.get(titulo) ?? { series: vm.series, points: [], aggregated: vm.aggregated };
    panel.points.push({ label: categoria, values: punto.values });
    paneles.set(titulo, panel);
  }

  if (paneles.size === 0) return { paneles: [{ titulo: '', vm }], omitidos: 0 };

  /*
   * Se quedan los PRIMEROS del orden vigente, no los doce mayores.
   */
  const todos = [...paneles.entries()].map(([titulo, panel]) => ({ titulo, vm: panel }));
  return {
    paneles: todos.slice(0, MAX_PANELES),
    omitidos: Math.max(0, todos.length - MAX_PANELES),
  };
}

/** El maximo de TODOS los paneles, para fijarles una escala comun. */
export function maximoComun(paneles: PanelDeMultiplo[]): number | undefined {
  const valores = paneles.flatMap((p) =>
    p.vm.points.flatMap((punto) => punto.values.filter((v): v is number => v !== null)),
  );
  if (valores.length === 0) return undefined;
  return Math.max(...valores);
}

/** Cuantas columnas usar para `n` paneles. */
export function columnasPara(n: number, pedidas?: number): number {
  if (pedidas !== undefined && pedidas > 0) return Math.min(pedidas, 4);
  return Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
}
