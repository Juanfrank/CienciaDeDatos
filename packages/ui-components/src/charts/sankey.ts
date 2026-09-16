import { LABEL_SEPARATOR, type CategoricalViewModel } from '../registry/viewModel';

/**
 * Diagrama de flujo — cuanto pasa de cada etapa a la siguiente.
 *
 * El embudo ensena etapas que solo menguan; esto ensena a DONDE va lo que sale de cada una, que es
 * la pregunta cuando el proceso se ramifica: de las audiencias celebradas, cuantas acaban en
 * sentencia y cuantas se devuelven.
 */

export interface Flow {
  source: string;
  target: string;
  value: number;
}

export interface FlowGraph {
  /** Los nodos, en el orden en que aparecen. */
  nodes: string[];
  /** Lo que se puede dibujar. */
  links: Flow[];
  /**
   * Lo que NO se puede dibujar, con su motivo.
   *
   * Un diagrama de flujo es un grafo dirigido ACICLICO: un ciclo no tiene reparto posible en el
   * lienzo y deja el trazado dando vueltas. En un proceso judicial los hay de verdad —una
   * apelacion devuelve el expediente a primera instancia—, asi que se apartan, y se apartan CON
   * NOMBRE: quitarlos en silencio dibujaria un proceso que no es el que hay.
   */
  dropped: (Flow & { why: 'ciclo' | 'a-si-mismo' })[];
}

/** Si anadir `link` cerraria un ciclo sobre lo ya aceptado. */
function closesCycle(links: Flow[], link: Flow): boolean {
  const pendientes = [link.target];
  const vistos = new Set<string>();

  while (pendientes.length > 0) {
    const nodo = pendientes.pop() as string;
    if (nodo === link.source) return true;
    if (vistos.has(nodo)) continue;
    vistos.add(nodo);
    for (const otro of links) if (otro.source === nodo) pendientes.push(otro.target);
  }
  return false;
}

/**
 * Arma el grafo a partir de un modelo de DOS dimensiones.
 *
 * `toCategorical` compone «Ingreso / Audiencia», asi que el origen es lo que va antes del separador
 * y el destino lo que va detras. Los flujos sin cifra no entran: un enlace de grosor nulo dibuja
 * una linea que no lleva nada.
 */
export function flowsOf(vm: CategoricalViewModel): FlowGraph {
  const nodes: string[] = [];
  const links: Flow[] = [];
  const dropped: FlowGraph['dropped'] = [];

  const anotar = (nombre: string) => {
    if (nombre !== '' && !nodes.includes(nombre)) nodes.push(nombre);
  };

  for (const punto of vm.points) {
    const corte = punto.label.indexOf(LABEL_SEPARATOR);
    if (corte < 0) continue;

    const source = punto.label.slice(0, corte);
    const target = punto.label.slice(corte + LABEL_SEPARATOR.length);
    const value = punto.values[0];
    if (value === null || value === undefined || value <= 0) continue;

    const flujo = { source, target, value };

    if (source === target) {
      dropped.push({ ...flujo, why: 'a-si-mismo' });
      continue;
    }
    if (closesCycle(links, flujo)) {
      dropped.push({ ...flujo, why: 'ciclo' });
      continue;
    }

    anotar(source);
    anotar(target);
    links.push(flujo);
  }

  return { nodes, links, dropped };
}

/** Cuanto sale de un nodo, para poder decir la parte que se lleva cada rama. */
export const outgoingOf = (graph: FlowGraph, nodo: string): number =>
  graph.links.filter((l) => l.source === nodo).reduce((suma, l) => suma + l.value, 0);
