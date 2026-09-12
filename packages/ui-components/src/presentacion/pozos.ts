import type { FieldRef } from '@app/data-contracts';
import type { ObjectDataContract, ObjectInstance } from '../registry/types';
import { fieldKey } from '../registry/viewModel';

/**
 * Ranuras con nombre — seccion 4.2.
 *
 * ## Por que se rehizo
 *
 * La primera version usaba el ORDEN del array como criterio de reparto: el primer pozo se quedaba
 * los primeros campos, el siguiente los siguientes. Se sostiene mientras se llenan en orden y se
 * rompe en cuanto uno quiere saltarse alguno. En un grafico de barras con eje X, serie y eje Y,
 * no habia forma de poner SOLO la serie: el primer campo que se anadiera caeria en el eje X,
 * porque «primero» es lo unico que el reparto sabia mirar.
 *
 * Ahora el campo dice a QUE RANURA pertenece. `binding.ranuras` es un mapa de identificador de
 * ranura a claves de campo, y es la fuente de verdad. Un eje X vacio con una serie llena es un
 * estado perfectamente expresable, que es justo lo que faltaba.
 *
 * ## Que se conserva, y por que
 *
 * `binding.dimensions` y `binding.measures` siguen existiendo y siguen siendo la lista de columnas
 * que el objeto necesita: es lo que leen el lector del cache, la validacion de esquema, la
 * proyeccion y la exportacion. Se DERIVAN de las ranuras y se guardan junto a ellas, de modo que
 * nada rio abajo cambia. Lo que cambia es quien manda: antes el array, ahora el mapa.
 *
 * Una instancia sin `ranuras` —todo lo guardado antes de esto— se interpreta con el reparto
 * posicional de siempre. La migracion es una funcion pura y probada, no un script que haya que
 * acordarse de ejecutar.
 */

export interface RanuraDeCampos {
  id: string;
  /** Como se llama en el editor: «Eje X», «Valor», «Detalle». */
  etiqueta: string;
  tipo: 'dimension' | 'medida';
  /** Cuantos campos caben. */
  max: number;
  /**
   * Cuantos hacen falta para que el objeto se dibuje. 0 = opcional.
   *
   * Es lo que permite decir «el eje X es obligatorio y la serie no» en vez de deducirlo del minimo
   * global del contrato, que no sabe repartirlo entre ranuras.
   */
  min?: number;
  /** Una linea que explica que hace la ranura con lo que se le ponga. */
  ayuda?: string;
}

/** Compatibilidad: el nombre anterior del mismo concepto. */
export type PozoDeCampos = RanuraDeCampos;

/** Asignacion de campos a ranuras. La clave es el id de la ranura. */
export type AsignacionDeRanuras = Record<string, string[]>;

export const aFieldRef = (clave: string): FieldRef => {
  const [table = '', field = ''] = clave.split('.');
  return { table, field };
};

/**
 * Las ranuras de una instancia, con sus campos.
 *
 * Si la instancia trae `ranuras`, mandan. Si no, se deduce del orden —que es como se guardo— y se
 * devuelve lo mismo que habria devuelto la version anterior. Sin esa deduccion, cada modulo
 * guardado antes de este cambio apareceria con todas las ranuras vacias y sus campos perdidos.
 */
export function ranurasDe(
  instance: ObjectInstance,
  ranuras: RanuraDeCampos[],
): Map<string, string[]> {
  const declaradas = new Map<string, string[]>(ranuras.map((r) => [r.id, []]));
  const guardadas = instance.binding.ranuras;

  if (guardadas) {
    for (const ranura of ranuras) {
      // Se filtra contra el maximo: una asignacion guardada con mas campos de los que la ranura
      // admite —porque el objeto cambio de version— no puede desbordar en silencio.
      declaradas.set(ranura.id, (guardadas[ranura.id] ?? []).slice(0, ranura.max));
    }
    return declaradas;
  }

  const claves = {
    dimension: instance.binding.dimensions.map(fieldKey),
    medida: [...instance.binding.measures],
  };
  for (const ranura of ranuras) {
    declaradas.set(ranura.id, claves[ranura.tipo].splice(0, ranura.max));
  }
  return declaradas;
}

/**
 * Los arrays que consumen el lector, la validacion y la proyeccion.
 *
 * Salen de las ranuras EN EL ORDEN EN QUE SE DECLARAN, no en el que se llenaron. Es lo que hace
 * que dos modulos con los mismos campos en las mismas ranuras produzcan la misma consulta, y por
 * tanto la misma clave de cache.
 */
export function bindingDesdeRanuras(
  asignacion: Map<string, string[]>,
  ranuras: RanuraDeCampos[],
): { dimensions: FieldRef[]; measures: string[]; ranuras: AsignacionDeRanuras } {
  const dimensions: FieldRef[] = [];
  const measures: string[] = [];
  const mapa: AsignacionDeRanuras = {};

  for (const ranura of ranuras) {
    const campos = asignacion.get(ranura.id) ?? [];
    mapa[ranura.id] = campos;
    if (ranura.tipo === 'dimension') dimensions.push(...campos.map(aFieldRef));
    else measures.push(...campos);
  }

  return { dimensions, measures, ranuras: mapa };
}

/** Pone un campo en una ranura concreta. Devuelve la instancia nueva. */
export function conCampoEnRanura(
  instance: ObjectInstance,
  ranuras: RanuraDeCampos[],
  ranuraId: string,
  campo: string,
): ObjectInstance {
  const ranura = ranuras.find((r) => r.id === ranuraId);
  if (!ranura) return instance;

  const asignacion = ranurasDe(instance, ranuras);
  const actuales = asignacion.get(ranuraId) ?? [];
  if (actuales.length >= ranura.max || actuales.includes(campo)) return instance;

  asignacion.set(ranuraId, [...actuales, campo]);
  return { ...instance, binding: { ...instance.binding, ...bindingDesdeRanuras(asignacion, ranuras) } };
}

/**
 * Quita un campo de UNA ranura, no de todas.
 *
 * El mismo campo puede estar en dos ranuras a la vez —una fecha en el eje X y en el detalle, por
 * ejemplo— y quitarlo de una no debe vaciar la otra. Es la diferencia entre «quitar este chiclet»
 * y «quitar este campo del objeto», y en pantalla se pulsa un chiclet concreto.
 */
export function sinCampoEnRanura(
  instance: ObjectInstance,
  ranuras: RanuraDeCampos[],
  ranuraId: string,
  campo: string,
): ObjectInstance {
  const asignacion = ranurasDe(instance, ranuras);
  asignacion.set(ranuraId, (asignacion.get(ranuraId) ?? []).filter((c) => c !== campo));
  return { ...instance, binding: { ...instance.binding, ...bindingDesdeRanuras(asignacion, ranuras) } };
}

/** Si cabe otro campo en esa ranura. */
export function cabeEnRanura(
  instance: ObjectInstance,
  ranuras: RanuraDeCampos[],
  ranuraId: string,
): boolean {
  const ranura = ranuras.find((r) => r.id === ranuraId);
  if (!ranura) return false;
  return (ranurasDe(instance, ranuras).get(ranuraId) ?? []).length < ranura.max;
}

/** El primer campo de una ranura, que es lo que piden las ranuras de cupo uno. */
export function campoDeRanura(
  instance: ObjectInstance,
  ranuras: RanuraDeCampos[],
  ranuraId: string,
): string | undefined {
  return ranurasDe(instance, ranuras).get(ranuraId)?.[0];
}

export interface ProblemaDeRanura {
  ranura: string;
  problema: string;
}

/**
 * Valida la asignacion contra lo que las ranuras declaran.
 *
 * Comprueba lo que el contrato global NO puede: que cada ranura tenga lo que necesita. Un grafico
 * de barras con una dimension cumple «entre 1 y 2 dimensiones» tanto si esa dimension esta en el
 * eje X como si esta en la serie, y solo el segundo caso es un grafico que no se puede dibujar.
 */
export function validarRanuras(
  instance: ObjectInstance,
  ranuras: RanuraDeCampos[],
): ProblemaDeRanura[] {
  if (ranuras.length === 0) return [];
  const problemas: ProblemaDeRanura[] = [];
  const asignacion = ranurasDe(instance, ranuras);

  for (const ranura of ranuras) {
    const campos = asignacion.get(ranura.id) ?? [];
    const minimo = ranura.min ?? 0;
    if (campos.length < minimo) {
      problemas.push({
        ranura: ranura.id,
        problema:
          `'${ranura.etiqueta}' necesita ${minimo} ${minimo === 1 ? 'campo' : 'campos'} y ` +
          `tiene ${campos.length}.`,
      });
    }
    if (campos.length > ranura.max) {
      problemas.push({
        ranura: ranura.id,
        problema: `'${ranura.etiqueta}' admite ${ranura.max} y tiene ${campos.length}.`,
      });
    }
    if (new Set(campos).size !== campos.length) {
      problemas.push({
        ranura: ranura.id,
        problema: `'${ranura.etiqueta}' tiene el mismo campo dos veces.`,
      });
    }
  }

  // Una ranura guardada que el objeto ya no declara: pasa al cambiar de version, y sus campos
  // quedarian mapeados sin que el editor los muestre ni nadie pueda quitarlos.
  for (const id of Object.keys(instance.binding.ranuras ?? {})) {
    if (!ranuras.some((r) => r.id === id) && (instance.binding.ranuras?.[id]?.length ?? 0) > 0) {
      problemas.push({
        ranura: id,
        problema: `Este objeto ya no tiene la ranura '${id}', y quedan campos asignados a ella.`,
      });
    }
  }

  return problemas;
}

/**
 * Las ranuras por defecto cuando un objeto no las declara.
 *
 * Una por tipo, con el rotulo generico de siempre. Es lo que hace que anadir un objeto al catalogo
 * no obligue a declarar ranuras: se comporta como antes, y quien quiera nombres los declara.
 */
export function ranurasPorDefecto(contrato: ObjectDataContract): RanuraDeCampos[] {
  const ranuras: RanuraDeCampos[] = [];
  if (contrato.dimensions.max > 0) {
    ranuras.push({
      id: 'dimensiones',
      etiqueta: 'Dimensiones',
      tipo: 'dimension',
      max: contrato.dimensions.max,
      min: contrato.dimensions.min,
    });
  }
  if (contrato.measures.max > 0) {
    ranuras.push({
      id: 'medidas',
      etiqueta: 'Medidas',
      tipo: 'medida',
      max: contrato.measures.max,
      min: contrato.measures.min,
    });
  }
  return ranuras;
}

/** Las ranuras efectivas de una version: las declaradas, o las genericas. */
export function ranurasDelContrato(contrato: ObjectDataContract): RanuraDeCampos[] {
  return contrato.pozos && contrato.pozos.length > 0
    ? contrato.pozos
    : ranurasPorDefecto(contrato);
}
