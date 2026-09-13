import { AGGREGATIONS, type Aggregation, type GranoDeDataset, esAditiva } from '@app/data-contracts';

/** Como se resume una columna. UN solo acumulador para toda la aplicacion. */

const aNumero = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** El estado parcial de una agregacion en curso. */
export interface Acumulador {
  aggregation: Aggregation;
  suma: number;
  recuento: number;
  minimo: number | null;
  maximo: number | null;
  distintos: Set<string> | null;
  /** El primer valor visto. Es lo que devuelve `ninguna`, que no combina nada. */
  primero: number | null;
  /** true si al grupo llego mas de una fila. `ninguna` lo usa para saber que no puede responder. */
  colapsado: boolean;
}

export function nuevoAcumulador(aggregation: Aggregation): Acumulador {
  return {
    aggregation,
    suma: 0,
    recuento: 0,
    minimo: null,
    maximo: null,
    distintos: aggregation === 'recuento-distinto' ? new Set<string>() : null,
    primero: null,
    colapsado: false,
  };
}

export function acumular(acc: Acumulador, valor: unknown): void {
  const n = aNumero(valor);
  if (acc.recuento > 0) acc.colapsado = true;
  if (acc.primero === null) acc.primero = n;
  acc.suma += n;
  acc.recuento += 1;
  acc.minimo = acc.minimo === null ? n : Math.min(acc.minimo, n);
  acc.maximo = acc.maximo === null ? n : Math.max(acc.maximo, n);
  // El distinto se cuenta sobre el valor TAL CUAL, no sobre su conversion a numero: dos
  // identificadores distintos que no son numeros convertirian los dos a 0 y contarian como uno.
  acc.distintos?.add(String(valor));
}

/** Cierra el acumulador. */
export function close(acc: Acumulador): number | null {
  switch (acc.aggregation) {
    case 'suma':
      return acc.suma;
    case 'promedio':
      return acc.recuento === 0 ? null : acc.suma / acc.recuento;
    case 'minimo':
      return acc.minimo;
    case 'maximo':
      return acc.maximo;
    case 'recuento':
      return acc.recuento;
    case 'recuento-distinto':
      return acc.distintos?.size ?? 0;
    case 'ninguna':
      return acc.colapsado ? null : acc.primero;
    default: {
      const exhaustivo: never = acc.aggregation;
      throw new Error(`Agregacion desconocida: ${String(exhaustivo)}`);
    }
  }
}

/** Agregacion por defecto cuando el esquema no dice nada. Ver `aggregationsOf`. */
export const DEFAULT_AGGREGATION: Aggregation = 'suma';

/** Que operador usar para cada medida de un mapeo. */
export function aggregationsOf(
  medidas: string[],
  declaradas: Map<string, Aggregation>,
  elegidas: Record<string, Aggregation> | undefined,
): Aggregation[] {
  return medidas.map(
    (m) => elegidas?.[m] ?? declaradas.get(m) ?? DEFAULT_AGGREGATION,
  );
}


/** Reordena los operadores para una lista de medidas concreta. */
export function aggregationsFor(
  medidas: string[],
  todas: string[],
  aggregations: Aggregation[],
): Aggregation[] {
  return medidas.map((m) => aggregations[todas.indexOf(m)] ?? DEFAULT_AGGREGATION);
}

/** Como se llama cada operador en pantalla. */
export const AGGREGATION_LABEL: Record<Aggregation, string> = {
  suma: 'Suma',
  promedio: 'Promedio',
  minimo: 'Minimo',
  maximo: 'Maximo',
  recuento: 'Recuento',
  'recuento-distinto': 'Recuento distinto',
  ninguna: 'Sin resumir',
};

export interface AggregationProblem {
  medida: string;
  aggregation: Aggregation;
  issue: string;
}

/** La comprobacion que hace que el numero falso deje de ser alcanzable desde el editor. */
export interface AggregationContext {
  /** true si el objeto muestra menos dimensiones de las que trae el dataset. */
  colapsa: boolean;
  dataGrain: GranoDeDataset;
}

/** Que operadores se pueden aplicar AQUI. Es la unica regla, y de ella sale todo lo demas. */
export function agregacionesPosibles(ctx: AggregationContext): Aggregation[] {
  if (!ctx.colapsa) return [...AGGREGATIONS];
  if (ctx.dataGrain === 'atomico') return AGGREGATIONS.filter((a) => a !== 'ninguna');
  return AGGREGATIONS.filter(esAditiva);
}

/** Por que NO se puede aplicar este operador aqui. `null` si si se puede. */
function porQueNoSePuede(
  medida: string,
  aggregation: Aggregation,
  ctx: AggregationContext,
): string | null {
  if (agregacionesPosibles(ctx).includes(aggregation)) return null;

  if (aggregation === 'ninguna') {
    return (
      `'${medida}' viene ya calculada de la fuente, asi que no se puede volver a resumir. ` +
      `Este objeto agrupa varias filas en una, y no hay forma de combinar un valor que la ` +
      `fuente dio por cerrado: anada las dimensiones que faltan, o elija otra medida.`
    );
  }

  return (
    `'${medida}' se resume con '${aggregation}', y el dataset viene ya agrupado. Sobre filas ` +
    `agrupadas solo se pueden volver a aplicar suma, minimo y maximo: un ${aggregation} de ` +
    `valores que ya son un ${aggregation} solo coincide con el real si todos los grupos pesan ` +
    `igual. Use un dataset de grano atomico, o muestre el objeto al grano del dataset.`
  );
}

/** Los operadores de un mapeo que no se pueden aplicar. */
export function validateAggregation(
  input: AggregationContext & { measures: string[]; aggregations: Aggregation[] },
): AggregationProblem[] {
  const problems: AggregationProblem[] = [];
  input.measures.forEach((medida, i) => {
    const aggregation = input.aggregations[i] ?? DEFAULT_AGGREGATION;
    const issue = porQueNoSePuede(medida, aggregation, input);
    if (issue) problems.push({ medida, aggregation, issue });
  });
  return problems;
}
