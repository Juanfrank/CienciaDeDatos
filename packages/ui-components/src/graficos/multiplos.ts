import type { CategoricalViewModel } from '../registry/viewModel';

/**
 * Pequenos multiplos — el mismo grafico, una vez por cada valor de una dimension.
 *
 * Es la pregunta que hoy obliga a poner seis objetos identicos uno al lado del otro y a
 * mantenerlos sincronizados a mano: cambiar el formato, el orden o una medida significa repetir el
 * cambio seis veces, y la primera vez que alguien se salta uno, el panel miente.
 *
 * Lo que hace comparables los paneles es que compartan ESCALA. Sin eso, seis graficos de alturas
 * iguales pueden estar diciendo 20 y 2.000, y la comparacion —que es la unica razon de ponerlos
 * juntos— sale al reves. Por eso la escala comun es el valor por defecto y no una opcion que haya
 * que descubrir.
 */

/** Separador con el que `toCategorical` compone las etiquetas de varias dimensiones. */
const SEPARADOR = ' / ';

/**
 * Cuantos paneles se dibujan como maximo.
 *
 * Cada panel es una instancia de ECharts: una dimension con cincuenta valores montaria cincuenta
 * en una sola tarjeta, y eso no es un grafico lento sino un navegador bloqueado. Ademas, cincuenta
 * graficos del tamano de un sello no dicen nada — que es el otro motivo, y el que de verdad
 * importa: el limite existe porque por encima de el los multiplos dejan de servir para lo que
 * sirven, no solo porque cuesten.
 *
 * Doce caben en tres columnas de cuatro y siguen siendo legibles.
 */
export const MAX_PANELES = 12;

export interface PanelDeMultiplo {
  /** El valor de la dimension que reparte: el titulo de este panel. */
  titulo: string;
  vm: CategoricalViewModel;
}

/**
 * Parte un modelo de vista de DOS dimensiones en uno por cada valor de la primera.
 *
 * El modelo llega con las etiquetas ya compuestas —«Penal / Q1»— porque asi es como
 * `toCategorical` agrega cuando hay varias dimensiones. Aqui se deshace esa composicion: el primer
 * trozo es el panel y el segundo la categoria del eje.
 *
 * Sin la segunda dimension no hay nada que partir y se devuelve un solo panel, que es lo que
 * permite que el render no tenga que preguntarse si el mapeo trae multiplo o no.
 */
export interface ParticionEnMultiplos {
  paneles: PanelDeMultiplo[];
  /**
   * Cuantos quedaron fuera del limite.
   *
   * Se devuelve para poder DECIRLO. Recortar en silencio deja a quien mira creyendo que la
   * dimension tiene doce valores, que es exactamente la clase de mentira que 4.2 cierra cuando
   * obliga a marcar un objeto roto en vez de omitirlo.
   */
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
   *
   * «Los mayores» seria una decision tomada a espaldas de quien edita: el orden lo fija el panel
   * —por categoria, por valor, ascendente o descendente— y respetarlo significa que para ver
   * otros doce basta con cambiarlo, en vez de tener que adivinar por que aparecen esos.
   */
  const todos = [...paneles.entries()].map(([titulo, panel]) => ({ titulo, vm: panel }));
  return {
    paneles: todos.slice(0, MAX_PANELES),
    omitidos: Math.max(0, todos.length - MAX_PANELES),
  };
}

/**
 * El maximo de TODOS los paneles, para fijarles una escala comun.
 *
 * Los nulos no entran: `Math.max` con un nulo lo convierte en cero, y con todos los valores en
 * hueco daria cero y todos los paneles a escala completa.
 *
 * Devuelve `undefined` cuando no hay ni un valor, para que quien lo consuma no fije un maximo
 * inventado: un panel sin datos con el eje clavado en cero se lee como «cero casos», que es una
 * afirmacion distinta de «no hay datos».
 */
export function maximoComun(paneles: PanelDeMultiplo[]): number | undefined {
  const valores = paneles.flatMap((p) =>
    p.vm.points.flatMap((punto) => punto.values.filter((v): v is number => v !== null)),
  );
  if (valores.length === 0) return undefined;
  return Math.max(...valores);
}

/**
 * Cuantas columnas usar para `n` paneles.
 *
 * Se elige la rejilla mas cuadrada que no pase de cuatro columnas: mas de cuatro deja cada panel
 * tan estrecho que sus rotulos dejan de caber, y entonces los multiplos cuestan mas de lo que
 * ahorran.
 */
export function columnasPara(n: number, pedidas?: number): number {
  if (pedidas !== undefined && pedidas > 0) return Math.min(pedidas, 4);
  return Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
}
