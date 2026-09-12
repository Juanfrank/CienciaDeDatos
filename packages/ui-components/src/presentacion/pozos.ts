import type { ObjectDataContract } from '../registry/types';

/**
 * Pozos de campos: las ranuras CON NOMBRE de un objeto — seccion 4.2.
 *
 * El editor pedia «dimensiones» y «medidas» como dos listas planas. Para una tarjeta eso vale;
 * para un grafico de barras no dice nada: la primera dimension es el eje de categorias y la
 * segunda agrupa las barras en series, y las dos salian juntas bajo el mismo rotulo. Quien
 * construye un modulo no piensa en «la dimension numero dos», piensa en «la serie».
 *
 * La decision importante es que un pozo NO cambia el modelo de datos. `binding.dimensions` y
 * `binding.measures` siguen siendo dos arrays ordenados, y un pozo es una PARTICION con nombre
 * sobre uno de ellos: el primero se queda los primeros `max` elementos, el siguiente los
 * siguientes, y asi. Cambiar el modelo habria obligado a migrar cada modulo guardado, cada
 * validacion y cada proyeccion, para no ganar nada que el orden no diera ya.
 *
 * Consecuencia que conviene saber: quitar un campo de un pozo corre los del siguiente. Es lo que
 * pasa en cualquier lista ordenada, y es la razon de que los pozos se declaren en el MISMO orden
 * en el que el objeto consume sus campos.
 */

export interface PozoDeCampos {
  id: string;
  /** Como se llama en el editor: «Eje X», «Valor», «Detalle». */
  etiqueta: string;
  tipo: 'dimension' | 'medida';
  /** Cuantos campos caben. La suma de los pozos de un tipo cuadra con el contrato de datos. */
  max: number;
  /** Una linea que explica que hace este pozo con lo que se le ponga. */
  ayuda?: string;
}

/**
 * Reparte una lista ordenada entre sus pozos, en orden y sin dejar nada fuera.
 *
 * Lo que sobra —mas campos que capacidad declarada— se devuelve aparte en vez de perderse. Puede
 * pasar con un modulo guardado antes de que el objeto declarara sus pozos, y esconderlo dejaria
 * campos mapeados que el editor no muestra y nadie puede quitar.
 */
export function repartirEnPozos<T>(
  valores: T[],
  pozos: PozoDeCampos[],
): { porPozo: Map<string, T[]>; sobrantes: T[] } {
  const porPozo = new Map<string, T[]>();
  let i = 0;
  for (const pozo of pozos) {
    porPozo.set(pozo.id, valores.slice(i, i + pozo.max));
    i += Math.min(pozo.max, Math.max(0, valores.length - i));
  }
  return { porPozo, sobrantes: valores.slice(i) };
}

/**
 * El indice donde insertar un campo nuevo en un pozo: al final de SU tramo.
 *
 * Insertar siempre al final del array entero pondria el campo en el pozo equivocado en cuanto
 * hubiera mas de uno, y es el fallo que no se ve hasta que alguien mapea una serie y aparece en
 * el eje.
 */
export function indiceDeInsercion<T>(
  valores: T[],
  pozos: PozoDeCampos[],
  pozoId: string,
): number {
  const { porPozo } = repartirEnPozos(valores, pozos);
  let indice = 0;
  for (const pozo of pozos) {
    indice += (porPozo.get(pozo.id) ?? []).length;
    if (pozo.id === pozoId) return indice;
  }
  return valores.length;
}

/** Si cabe otro campo en ese pozo. */
export function cabeEn<T>(valores: T[], pozos: PozoDeCampos[], pozoId: string): boolean {
  const pozo = pozos.find((p) => p.id === pozoId);
  if (!pozo) return false;
  const { porPozo } = repartirEnPozos(valores, pozos);
  return (porPozo.get(pozoId) ?? []).length < pozo.max;
}

/**
 * Los pozos por defecto cuando un objeto no los declara.
 *
 * Uno por tipo, con el rotulo generico de siempre. Es lo que hace que anadir un objeto al catalogo
 * no obligue a declarar pozos: se comporta como antes, y quien quiera nombres los declara.
 */
export function pozosPorDefecto(contrato: ObjectDataContract): {
  dimensiones: PozoDeCampos[];
  medidas: PozoDeCampos[];
} {
  return {
    dimensiones:
      contrato.dimensions.max > 0
        ? [
            {
              id: 'dimensiones',
              etiqueta: 'Dimensiones',
              tipo: 'dimension',
              max: contrato.dimensions.max,
            },
          ]
        : [],
    medidas:
      contrato.measures.max > 0
        ? [{ id: 'medidas', etiqueta: 'Medidas', tipo: 'medida', max: contrato.measures.max }]
        : [],
  };
}
