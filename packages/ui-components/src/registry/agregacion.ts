import { type Agregacion, type GranoDeDataset, esAditiva } from '@app/data-contracts';

/**
 * Como se resume una columna. UN solo acumulador para toda la aplicacion.
 *
 * Antes no habia ninguno: `aggregateBy`, `toKpi` y `toMatrix` sumaban cada uno por su cuenta, con
 * un `+` escrito tres veces. Sumar era la unica operacion posible, asi que una columna de dias
 * promedio se mostraba como la suma de sus promedios — 10 593 dias donde el promedio real eran
 * 165,5. No fallaba, no avisaba: devolvia un numero perfectamente plausible y falso, que en una
 * capa de visualizacion institucional es el peor modo de fallo que hay.
 *
 * Vive en un solo sitio a proposito. Con dos implementaciones del promedio, un grafico y la
 * exportacion del mismo objeto podrian dar cifras distintas — que es exactamente el motivo por el
 * que `toCategorical` ya delegaba en `aggregateBy` en vez de recorrer las filas otra vez.
 */

const aNumero = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * El estado parcial de una agregacion en curso.
 *
 * Un promedio necesita suma Y recuento; un distinto necesita el conjunto de lo ya visto. Por eso
 * no basta con un numero por grupo: hay que acumular lo suficiente para poder cerrar cualquiera
 * de los operadores al final.
 */
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

/**
 * Cierra el acumulador.
 *
 * `ninguna` devuelve el valor si el grupo trajo una sola fila, y `null` si trajo varias: la fuente
 * ya calculo ese numero y la aplicacion no tiene con que recalcularlo. Devolver la suma o el
 * primero seria inventar. Que `null` signifique «no hay respuesta» y no «cero» es la diferencia
 * entre marcar algo roto y mentir en silencio, que es la regla de 4.2.
 */
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

/**
 * Que operador usar para cada medida de un mapeo.
 *
 * Tres capas, de mas a menos especifica: lo que la instancia haya elegido en el pozo, lo que el
 * esquema declare para esa medida, y `suma` como ultimo recurso.
 *
 * Ese ultimo recurso es el comportamiento de siempre, y se conserva a proposito: un despliegue en
 * el que el job aun no ha refrescado el esquema no puede dejar todos los objetos en blanco. Lo que
 * antes no existia y ahora si es la validacion, que rechaza guardar un operador que el grano del
 * dataset no soporta — asi el defecto silencioso deja de ser alcanzable por la via del editor.
 */
export function agregacionesDe(
  medidas: string[],
  declaradas: Map<string, Agregacion>,
  elegidas: Record<string, Agregacion> | undefined,
): Agregacion[] {
  return medidas.map(
    (m) => elegidas?.[m] ?? declaradas.get(m) ?? AGREGACION_POR_DEFECTO,
  );
}


/**
 * Reordena los operadores para una lista de medidas concreta.
 *
 * `agregaciones` llega alineada con `binding.measures`, pero los objetos consumen sus medidas POR
 * RANURA: una tarjeta pide primero la del pozo «valor» y luego la de «comparacion», que pueden
 * estar al reves en el mapeo. Casar por indice daria a cada medida el operador de otra, que es
 * exactamente el fallo que las ranuras vinieron a quitar del mapeo de campos.
 */
export function agregacionesPara(
  medidas: string[],
  todas: string[],
  agregaciones: Agregacion[],
): Agregacion[] {
  return medidas.map((m) => agregaciones[todas.indexOf(m)] ?? AGREGACION_POR_DEFECTO);
}

/**
 * Como se llama cada operador en pantalla.
 *
 * «Sin resumir» es `ninguna`: lo que Power BI llama «No resumir». Se ofrece aunque casi siempre
 * sea la eleccion equivocada, porque es la unica correcta cuando la medida ya viene calculada de
 * la fuente — y elegirla donde no toca no dibuja un numero falso: la validacion la rechaza.
 */
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

/**
 * La comprobacion que hace que el numero falso deje de ser alcanzable desde el editor.
 *
 * Un objeto COLAPSA cuando muestra menos dimensiones de las que trae el dataset: varias filas de
 * origen caen en el mismo punto del grafico, en la misma celda o —en una tarjeta— todas en una.
 * Ahi es donde el operador importa, y donde el grano decide si se puede aplicar:
 *
 * - Sobre grano ATOMICO cualquier operador vale, porque cada fila es un hecho y no hay ninguna
 *   agregacion previa que arruinar. La unica excepcion es `ninguna`, que significa «esto ya viene
 *   calculado de la fuente»: si se colapsa, no hay nada con que recalcularlo.
 *
 * - Sobre grano PREAGREGADO solo valen las aditivas. Un promedio de promedios coincide con el
 *   promedio real unicamente si todos los grupos pesan igual, y un recuento distinto no se combina
 *   entre grupos de ninguna forma.
 *
 * Devuelve problemas en vez de lanzar, como `validateBinding`: el editor tiene que poder dibujar
 * el objeto marcado y decir que pasa, no quedarse en blanco (4.2). Y se comprueba en los dos
 * caminos —al guardar y al leer—, porque el grano de un dataset puede cambiar despues de que un
 * modulo se haya publicado: lo que era correcto al guardarlo deja de serlo sin que nadie toque
 * el modulo.
 */
export function validarAgregacion(input: {
  measures: string[];
  agregaciones: Agregacion[];
  /** true si el objeto muestra menos dimensiones de las que trae el dataset. */
  colapsa: boolean;
  grano: GranoDeDataset;
}): ProblemaDeAgregacion[] {
  if (!input.colapsa) return [];

  const problemas: ProblemaDeAgregacion[] = [];
  input.measures.forEach((medida, i) => {
    const agregacion = input.agregaciones[i] ?? AGREGACION_POR_DEFECTO;

    if (agregacion === 'ninguna') {
      problemas.push({
        medida,
        agregacion,
        problema:
          `'${medida}' viene ya calculada de la fuente, asi que no se puede volver a resumir. ` +
          `Este objeto agrupa varias filas en una, y no hay forma de combinar un valor que la ` +
          `fuente dio por cerrado: anada las dimensiones que faltan, o elija otra medida.`,
      });
      return;
    }

    if (input.grano === 'preagregado' && !esAditiva(agregacion)) {
      problemas.push({
        medida,
        agregacion,
        problema:
          `'${medida}' se resume con '${agregacion}', y el dataset viene ya agrupado. Sobre filas ` +
          `agrupadas solo se pueden volver a aplicar suma, minimo y maximo: un ${agregacion} de ` +
          `valores que ya son un ${agregacion} solo coincide con el real si todos los grupos pesan ` +
          `igual. Use un dataset de grano atomico, o muestre el objeto al grano del dataset.`,
      });
    }
  });

  return problemas;
}
