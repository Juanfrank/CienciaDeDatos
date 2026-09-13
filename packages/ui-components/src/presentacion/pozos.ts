import type { FieldRef } from '@app/data-contracts';
import type { ObjectDataContract, ObjectInstance } from '../registry/types';
import { fieldKey } from '../registry/viewModel';

/** Ranuras con nombre — seccion 4.2. */

export interface RanuraDeCampos {
  id: string;
  /** Como se llama en el editor: «Eje X», «Valor», «Detalle». */
  etiqueta: string;
  tipo: 'dimension' | 'medida';
  /** Cuantos campos caben. */
  max: number;
  /** Cuantos hacen falta para que el objeto se dibuje. 0 = opcional. */
  min?: number;
  /** Una linea que explica que hace la ranura con lo que se le ponga. */
  help?: string;
}

/** Compatibilidad: el nombre anterior del mismo concepto. */
export type PozoDeCampos = RanuraDeCampos;

/** Asignacion de campos a ranuras. La clave es el id de la ranura. */
export type AsignacionDeRanuras = Record<string, string[]>;

export const aFieldRef = (clave: string): FieldRef => {
  const [table = '', field = ''] = clave.split('.');
  return { table, field };
};

/** Las ranuras de una instancia, con sus campos. */
export function ranurasDe(
  instance: ObjectInstance,
  slots: RanuraDeCampos[],
): Map<string, string[]> {
  const declaradas = new Map<string, string[]>(slots.map((r) => [r.id, []]));
  const guardadas = instance.binding.slots;

  if (guardadas) {
    for (const ranura of slots) {
      // Se filtra contra el maximo: una asignacion guardada con mas campos de los que la ranura
      // admite —porque el objeto cambio de version— no puede desbordar en silencio.
      declaradas.set(ranura.id, (guardadas[ranura.id] ?? []).slice(0, ranura.max));
    }
    return declaradas;
  }

  const keys = {
    dimension: instance.binding.dimensions.map(fieldKey),
    medida: [...instance.binding.measures],
  };

  /*
   * DOS pasadas: primero los minimos de cada ranura, y solo despues el resto hasta el maximo.
   */
  for (const ranura of slots) {
    declaradas.set(ranura.id, keys[ranura.tipo].splice(0, ranura.min ?? 0));
  }
  for (const ranura of slots) {
    const puestos = declaradas.get(ranura.id) ?? [];
    puestos.push(...keys[ranura.tipo].splice(0, ranura.max - puestos.length));
  }
  return declaradas;
}

/** Los arrays que consumen el lector, la validacion y la proyeccion. */
export function bindingDesdeRanuras(
  asignacion: Map<string, string[]>,
  slots: RanuraDeCampos[],
): { dimensions: FieldRef[]; measures: string[]; slots: AsignacionDeRanuras } {
  const dimensions: FieldRef[] = [];
  const measures: string[] = [];
  const mapa: AsignacionDeRanuras = {};

  for (const ranura of slots) {
    const campos = asignacion.get(ranura.id) ?? [];
    mapa[ranura.id] = campos;
    if (ranura.tipo === 'dimension') dimensions.push(...campos.map(aFieldRef));
    else measures.push(...campos);
  }

  return { dimensions, measures, slots: mapa };
}

/** Pone un campo en una ranura concreta. Devuelve la instancia nueva. */
export function conCampoEnRanura(
  instance: ObjectInstance,
  slots: RanuraDeCampos[],
  ranuraId: string,
  fieldName: string,
): ObjectInstance {
  const ranura = slots.find((r) => r.id === ranuraId);
  if (!ranura) return instance;

  const asignacion = ranurasDe(instance, slots);
  const actuales = asignacion.get(ranuraId) ?? [];
  if (actuales.length >= ranura.max || actuales.includes(fieldName)) return instance;

  asignacion.set(ranuraId, [...actuales, fieldName]);
  return { ...instance, binding: { ...instance.binding, ...bindingDesdeRanuras(asignacion, slots) } };
}

/** Quita un campo de UNA ranura, no de todas. */
export function sinCampoEnRanura(
  instance: ObjectInstance,
  slots: RanuraDeCampos[],
  ranuraId: string,
  fieldName: string,
): ObjectInstance {
  const asignacion = ranurasDe(instance, slots);
  asignacion.set(ranuraId, (asignacion.get(ranuraId) ?? []).filter((c) => c !== fieldName));
  return { ...instance, binding: { ...instance.binding, ...bindingDesdeRanuras(asignacion, slots) } };
}

/** Si cabe otro campo en esa ranura. */
export function cabeEnRanura(
  instance: ObjectInstance,
  slots: RanuraDeCampos[],
  ranuraId: string,
): boolean {
  const ranura = slots.find((r) => r.id === ranuraId);
  if (!ranura) return false;
  return (ranurasDe(instance, slots).get(ranuraId) ?? []).length < ranura.max;
}

/** El primer campo de una ranura, que es lo que piden las ranuras de cupo uno. */
export function campoDeRanura(
  instance: ObjectInstance,
  slots: RanuraDeCampos[],
  ranuraId: string,
): string | undefined {
  return ranurasDe(instance, slots).get(ranuraId)?.[0];
}

export interface ProblemaDeRanura {
  ranura: string;
  issue: string;
}

/** Valida la asignacion contra lo que las ranuras declaran. */
export function validarRanuras(
  instance: ObjectInstance,
  slots: RanuraDeCampos[],
): ProblemaDeRanura[] {
  if (slots.length === 0) return [];
  const problems: ProblemaDeRanura[] = [];
  const asignacion = ranurasDe(instance, slots);

  for (const ranura of slots) {
    const campos = asignacion.get(ranura.id) ?? [];
    const minimo = ranura.min ?? 0;
    if (campos.length < minimo) {
      problems.push({
        ranura: ranura.id,
        issue:
          `'${ranura.etiqueta}' necesita ${minimo} ${minimo === 1 ? 'campo' : 'campos'} y ` +
          `tiene ${campos.length}.`,
      });
    }
    if (campos.length > ranura.max) {
      problems.push({
        ranura: ranura.id,
        issue: `'${ranura.etiqueta}' admite ${ranura.max} y tiene ${campos.length}.`,
      });
    }
    if (new Set(campos).size !== campos.length) {
      problems.push({
        ranura: ranura.id,
        issue: `'${ranura.etiqueta}' tiene el mismo campo dos veces.`,
      });
    }
  }

  // Una ranura guardada que el objeto ya no declara: pasa al cambiar de version, y sus campos
  // quedarian mapeados sin que el editor los muestre ni nadie pueda quitarlos.
  for (const id of Object.keys(instance.binding.slots ?? {})) {
    if (!slots.some((r) => r.id === id) && (instance.binding.slots?.[id]?.length ?? 0) > 0) {
      problems.push({
        ranura: id,
        issue: `Este objeto ya no tiene la ranura '${id}', y quedan campos asignados a ella.`,
      });
    }
  }

  return problems;
}

/** Las ranuras por defecto cuando un objeto no las declara. */
export function ranurasPorDefecto(contrato: ObjectDataContract): RanuraDeCampos[] {
  const slots: RanuraDeCampos[] = [];
  if (contrato.dimensions.max > 0) {
    slots.push({
      id: 'dimensiones',
      etiqueta: 'Dimensiones',
      tipo: 'dimension',
      max: contrato.dimensions.max,
      min: contrato.dimensions.min,
    });
  }
  if (contrato.measures.max > 0) {
    slots.push({
      id: 'medidas',
      etiqueta: 'Medidas',
      tipo: 'medida',
      max: contrato.measures.max,
      min: contrato.measures.min,
    });
  }
  return slots;
}

/** Las ranuras efectivas de una version: las declaradas, o las genericas. */
export function ranurasDelContrato(contrato: ObjectDataContract): RanuraDeCampos[] {
  return contrato.wells && contrato.wells.length > 0
    ? contrato.wells
    : ranurasPorDefecto(contrato);
}
