import type { Agregacion, QueryResult } from '@app/data-contracts';
import { type Acumulador, acumular, cerrar, nuevoAcumulador } from './agregacion';
import { fieldKey } from './viewModel';

/**
 * La matriz, con jerarquia de verdad.
 *
 * La primera version cruzaba UNA dimension de filas con UNA de columnas y una sola medida, y con
 * eso no hay nada que expandir: un cruce plano no tiene niveles. Pero una matriz es exactamente
 * el objeto donde la jerarquia importa —distrito y dentro materia, ano y dentro trimestre—, asi
 * que el limite no era una simplificacion: era lo que impedia usarla para lo que sirve.
 *
 * Dos decisiones que sostienen todo lo demas:
 *
 * 1. **Los subtotales se acumulan desde las filas de ORIGEN, para cada prefijo.** Al leer cada
 *    fila del dataset se alimenta su celda y tambien la de cada nivel por encima. Es lo que hace
 *    que colapsar un grupo muestre su subtotal ya calculado y, sobre todo, que ese subtotal sea
 *    correcto con cualquier operador: el promedio de un distrito es el de sus casos, no el de los
 *    promedios de sus materias, que solo coincidirian si todas pesaran igual.
 *
 * 2. **El prefijo vacio es el total.** Una ruta de longitud cero representa «todo», asi que los
 *    totales generales, los de fila y los de columna salen del mismo mecanismo que las celdas, sin
 *    un camino aparte que pueda divergir.
 */

/** Separador interno de rutas. No aparece en ninguna etiqueta visible. */
const SEP = '||';
/** Separa la ruta de fila de la de columna dentro de la misma clave. */
const CRUCE = '<>';

export const rutaClave = (ruta: readonly string[]): string => ruta.join(SEP);

const claveDeCelda = (fila: readonly string[], columna: readonly string[]): string =>
  `${rutaClave(fila)}${CRUCE}${rutaClave(columna)}`;

export interface NodoDeMatriz {
  /** Etiquetas desde la raiz hasta este nodo, incluida la suya. */
  ruta: string[];
  etiqueta: string;
  /** 0 para el primer nivel. */
  nivel: number;
  hijos: NodoDeMatriz[];
}

export interface MatrizJerarquica {
  filas: NodoDeMatriz[];
  columnas: NodoDeMatriz[];
  medidas: string[];
  /** Nombre de la dimension de cada nivel, para rotular la esquina y las cabeceras. */
  nivelesDeFila: string[];
  nivelesDeColumna: string[];
  /**
   * Valor de una combinacion. Rutas vacias son el total general.
   * `null` significa que esa combinacion no tiene filas de origen, que no es lo mismo que cero.
   */
  valor(rutaFila: readonly string[], rutaColumna: readonly string[], medida: number): number | null;
}

function insertar(raiz: NodoDeMatriz[], etiquetas: string[]): void {
  let nivel = raiz;
  const ruta: string[] = [];
  for (const [i, etiqueta] of etiquetas.entries()) {
    ruta.push(etiqueta);
    let nodo = nivel.find((n) => n.etiqueta === etiqueta);
    if (!nodo) {
      nodo = { ruta: [...ruta], etiqueta, nivel: i, hijos: [] };
      nivel.push(nodo);
    }
    nivel = nodo.hijos;
  }
}

export function construirMatriz(
  result: QueryResult,
  dimensionesDeFila: { table: string; field: string }[],
  dimensionesDeColumna: { table: string; field: string }[],
  medidas: string[],
  agregaciones: Agregacion[],
): MatrizJerarquica {
  const indice = (d: { table: string; field: string }) =>
    result.columns.findIndex((c) => c.name === fieldKey(d));
  const iFila = dimensionesDeFila.map(indice);
  const iColumna = dimensionesDeColumna.map(indice);
  const iMedida = medidas.map((m) => result.columns.findIndex((c) => c.name === m));

  const filas: NodoDeMatriz[] = [];
  const columnas: NodoDeMatriz[] = [];
  const celdas = new Map<string, Acumulador[]>();

  const acumuladoresDe = (clave: string): Acumulador[] => {
    let accs = celdas.get(clave);
    if (!accs) {
      accs = medidas.map((_, i) => nuevoAcumulador(agregaciones[i] ?? 'suma'));
      celdas.set(clave, accs);
    }
    return accs;
  };

  for (const fila of result.rows) {
    const etiquetasFila = iFila.map((i) => (i >= 0 ? String(fila[i]) : '(sin dato)'));
    const etiquetasColumna = iColumna.map((i) => (i >= 0 ? String(fila[i]) : '(sin dato)'));
    insertar(filas, etiquetasFila);
    insertar(columnas, etiquetasColumna);

    /*
     * Cada fila de origen alimenta su celda Y la de todos sus niveles por encima.
     *
     * Con tres niveles de fila y dos de columna son doce combinaciones de prefijo por fila leida.
     * Parece mucho y no lo es: evita recorrer el dataset otra vez por cada subtotal y, sobre todo,
     * evita calcular un subtotal a partir de otros ya calculados, que es donde un promedio deja de
     * ser el promedio.
     */
    for (let f = 0; f <= etiquetasFila.length; f += 1) {
      const prefijoFila = etiquetasFila.slice(0, f);
      for (let c = 0; c <= etiquetasColumna.length; c += 1) {
        const accs = acumuladoresDe(claveDeCelda(prefijoFila, etiquetasColumna.slice(0, c)));
        iMedida.forEach((columna, m) => {
          const acc = accs[m];
          if (acc && columna >= 0) acumular(acc, fila[columna]);
        });
      }
    }
  }

  return {
    filas,
    columnas,
    medidas,
    nivelesDeFila: dimensionesDeFila.map(fieldKey),
    nivelesDeColumna: dimensionesDeColumna.map(fieldKey),
    valor(rutaFila, rutaColumna, medida) {
      const acc = celdas.get(claveDeCelda(rutaFila, rutaColumna))?.[medida];
      return acc ? cerrar(acc) : null;
    },
  };
}

/**
 * Las filas que se DIBUJAN, en orden, segun lo que este colapsado.
 *
 * Un nodo colapsado aparece —con su subtotal— y sus descendientes no. Se devuelve plano y no
 * anidado porque una tabla HTML es plana: la jerarquia se expresa con la sangria y con el nivel,
 * no anidando filas.
 */
export function filasVisibles(
  nodos: NodoDeMatriz[],
  colapsados: ReadonlySet<string>,
): NodoDeMatriz[] {
  const salida: NodoDeMatriz[] = [];
  const recorrer = (lista: NodoDeMatriz[]) => {
    for (const nodo of lista) {
      salida.push(nodo);
      if (nodo.hijos.length > 0 && !colapsados.has(rutaClave(nodo.ruta))) recorrer(nodo.hijos);
    }
  };
  recorrer(nodos);
  return salida;
}

/** Las hojas de un arbol de columnas: las que llevan cifras. Un nodo colapsado cuenta como hoja. */
export function hojas(nodos: NodoDeMatriz[], colapsados: ReadonlySet<string>): NodoDeMatriz[] {
  const salida: NodoDeMatriz[] = [];
  const recorrer = (lista: NodoDeMatriz[]) => {
    for (const nodo of lista) {
      if (nodo.hijos.length === 0 || colapsados.has(rutaClave(nodo.ruta))) salida.push(nodo);
      else recorrer(nodo.hijos);
    }
  };
  recorrer(nodos);
  return salida;
}

export type Direccion = 'asc' | 'desc';

/**
 * Ordena una lista de nodos entre HERMANOS, sin romper la jerarquia.
 *
 * Ordenar la tabla entera por una columna destruiria los grupos: los hijos de un distrito
 * acabarian repartidos entre otros distritos. Se ordena cada nivel por separado, que es lo que
 * hace que «ordenar por total descendente» signifique lo que uno espera.
 */
export function ordenarNodos(
  nodos: NodoDeMatriz[],
  comparar: (a: NodoDeMatriz, b: NodoDeMatriz) => number,
): NodoDeMatriz[] {
  return [...nodos].sort(comparar).map((n) => ({ ...n, hijos: ordenarNodos(n.hijos, comparar) }));
}

/** Comparador de cifras: los huecos al final SIEMPRE, se ordene como se ordene. */
export function compararValores(a: number | null, b: number | null, direccion: Direccion): number {
  if (a === null && b === null) return 0;
  // Un hueco no es «lo mas pequeño»: es que no hay cifra. Se queda abajo en las dos direcciones,
  // porque lo contrario llena la cabecera de filas vacias en cuanto se invierte el orden.
  if (a === null) return 1;
  if (b === null) return -1;
  return direccion === 'asc' ? a - b : b - a;
}
