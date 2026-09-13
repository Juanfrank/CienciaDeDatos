import { AGREGACIONES, type Agregacion, type GranoDeDataset, esAditiva } from '@app/data-contracts';

/** Como se resume una columna. UN solo acumulador para toda la aplicacion. */

const aNumero = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** El estado parcial de una agregacion en curso. */
export interface Acumulador {
  agregacion: Agregacion;
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

export function nuevoAcumulador(agregacion: Agregacion): Acumulador {
  return {
    agregacion,
    suma: 0,
    recuento: 0,
    minimo: null,
    maximo: null,
    distintos: agregacion === 'recuento-distinto' ? new Set<string>() : null,
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
export function cerrar(acc: Acumulador): number | null {
  switch (acc.agregacion) {
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
      const exhaustivo: never = acc.agregacion;
      throw new Error(`Agregacion desconocida: ${String(exhaustivo)}`);
    }
  }
}

/** Agregacion por defecto cuando el esquema no dice nada. Ver `agregacionesDe`. */
export const AGREGACION_POR_DEFECTO: Agregacion = 'suma';

/** Que operador usar para cada medida de un mapeo. */
export function agregacionesDe(
  medidas: string[],
  declaradas: Map<string, Agregacion>,
  elegidas: Record<string, Agregacion> | undefined,
): Agregacion[] {
  return medidas.map(
    (m) => elegidas?.[m] ?? declaradas.get(m) ?? AGREGACION_POR_DEFECTO,
  );
}


/** Reordena los operadores para una lista de medidas concreta. */
export function agregacionesPara(
  medidas: string[],
  todas: string[],
  agregaciones: Agregacion[],
): Agregacion[] {
  return medidas.map((m) => agregaciones[todas.indexOf(m)] ?? AGREGACION_POR_DEFECTO);
}

/** Como se llama cada operador en pantalla. */
export const ETIQUETA_DE_AGREGACION: Record<Agregacion, string> = {
  suma: 'Suma',
  promedio: 'Promedio',
  minimo: 'Minimo',
  maximo: 'Maximo',
  recuento: 'Recuento',
  'recuento-distinto': 'Recuento distinto',
  ninguna: 'Sin resumir',
};

export interface ProblemaDeAgregacion {
  medida: string;
  agregacion: Agregacion;
  problema: string;
}

/** La comprobacion que hace que el numero falso deje de ser alcanzable desde el editor. */
export interface ContextoDeAgregacion {
  /** true si el objeto muestra menos dimensiones de las que trae el dataset. */
  colapsa: boolean;
  grano: GranoDeDataset;
}

/** Que operadores se pueden aplicar AQUI. Es la unica regla, y de ella sale todo lo demas. */
export function agregacionesPosibles(ctx: ContextoDeAgregacion): Agregacion[] {
  if (!ctx.colapsa) return [...AGREGACIONES];
  if (ctx.grano === 'atomico') return AGREGACIONES.filter((a) => a !== 'ninguna');
  return AGREGACIONES.filter(esAditiva);
}

/** Por que NO se puede aplicar este operador aqui. `null` si si se puede. */
function porQueNoSePuede(
  medida: string,
  agregacion: Agregacion,
  ctx: ContextoDeAgregacion,
): string | null {
  if (agregacionesPosibles(ctx).includes(agregacion)) return null;

  if (agregacion === 'ninguna') {
    return (
      `'${medida}' viene ya calculada de la fuente, asi que no se puede volver a resumir. ` +
      `Este objeto agrupa varias filas en una, y no hay forma de combinar un valor que la ` +
      `fuente dio por cerrado: anada las dimensiones que faltan, o elija otra medida.`
    );
  }

  return (
    `'${medida}' se resume con '${agregacion}', y el dataset viene ya agrupado. Sobre filas ` +
    `agrupadas solo se pueden volver a aplicar suma, minimo y maximo: un ${agregacion} de ` +
    `valores que ya son un ${agregacion} solo coincide con el real si todos los grupos pesan ` +
    `igual. Use un dataset de grano atomico, o muestre el objeto al grano del dataset.`
  );
}

/** Los operadores de un mapeo que no se pueden aplicar. */
export function validarAgregacion(
  input: ContextoDeAgregacion & { measures: string[]; agregaciones: Agregacion[] },
): ProblemaDeAgregacion[] {
  const problems: ProblemaDeAgregacion[] = [];
  input.measures.forEach((medida, i) => {
    const agregacion = input.agregaciones[i] ?? AGREGACION_POR_DEFECTO;
    const problema = porQueNoSePuede(medida, agregacion, input);
    if (problema) problems.push({ medida, agregacion, problema });
  });
  return problems;
}
