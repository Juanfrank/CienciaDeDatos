import type { ObjectInstance } from '../registry/types';
import { fieldKey } from '../registry/viewModel';

/** Panel de filtros — objeto visual de categoria `filtro`, seccion 4.4. */

export const PICKER_KINDS = [
  /** Pastillas de seleccion multiple. Lo que hacia el segmentador. Hasta ~8 valores. */
  'pastillas',
  /** Lista con casillas, desplazable. Para decenas de valores, con varios elegidos a la vez. */
  'lista',
  /** Desplegable de un solo valor. Ocupa una linea. */
  'desplegable',
  /** Campo de busqueda sobre los valores. Para cientos. */
  'busqueda',
  /** Un dia. Solo sobre dimensiones de fecha. */
  'calendario',
  /** Desde y hasta. Solo sobre dimensiones de fecha. */
  'rango-de-fechas',
] as const;

export type PickerKind = (typeof PICKER_KINDS)[number];

/** Los que EXIGEN una dimension de fecha. Sobre un texto no significan nada. */
export const DATE_PICKERS: PickerKind[] = ['calendario', 'rango-de-fechas'];

/** Los tipos de columna que cuentan como fecha. */
const DATE_KINDS = new Set(['date', 'datetime', 'timestamp', 'fecha']);

export const dateKindIs = (tipo: string): boolean => DATE_KINDS.has(tipo.toLowerCase());

export interface DimensionPicker {
  /** Clave de la dimension, `Tabla.Campo`. Tiene que ser una de las mapeadas en el binding. */
  fieldName: string;
  tipo: PickerKind;
  /** Rotulo. Sin el, se usa el nombre del campo. */
  etiqueta?: string;
}

export interface FiltersPanelSettings {
  pickers: DimensionPicker[];
}

export const PANEL_DIMENSIONS_MAX = 10;

/** El selector por defecto de una dimension. */
export function defaultPicker(columnKind: string): PickerKind {
  return dateKindIs(columnKind) ? 'rango-de-fechas' : 'pastillas';
}

export interface PickerProblem {
  fieldName: string;
  issue: string;
}

/** Valida los selectores contra las dimensiones mapeadas y sus tipos. */
export function validatePanelFilters(
  instance: ObjectInstance,
  settings: FiltersPanelSettings | undefined,
  fieldKinds: Record<string, string>,
): PickerProblem[] {
  const problems: PickerProblem[] = [];
  const dimensiones = instance.binding.dimensions.map(fieldKey);
  const pickers = settings?.pickers ?? [];

  const vistos = new Set<string>();
  for (const picker of pickers) {
    if (!dimensiones.includes(picker.fieldName)) {
      problems.push({
        fieldName: picker.fieldName,
        issue:
          `'${picker.fieldName}' no esta entre las dimensiones mapeadas de este panel. ` +
          `Mapeadas: ${dimensiones.join(', ') || 'ninguna'}.`,
      });
      continue;
    }

    if (vistos.has(picker.fieldName)) {
      problems.push({
        fieldName: picker.fieldName,
        issue: `'${picker.fieldName}' tiene mas de un selector. Cada dimension lleva uno.`,
      });
    }
    vistos.add(picker.fieldName);

    if (!(PICKER_KINDS as readonly string[]).includes(picker.tipo)) {
      problems.push({
        fieldName: picker.fieldName,
        issue: `'${String(picker.tipo)}' no es un tipo de selector.`,
      });
      continue;
    }

    const columnKind = fieldKinds[picker.fieldName];
    if (
      DATE_PICKERS.includes(picker.tipo) &&
      columnKind !== undefined &&
      !dateKindIs(columnKind)
    ) {
      problems.push({
        fieldName: picker.fieldName,
        issue:
          `El selector '${picker.tipo}' necesita una dimension de fecha, y ` +
          `'${picker.fieldName}' es de tipo '${columnKind}'.`,
      });
    }
  }

  return problems;
}

/** Los selectores efectivos: los configurados, mas uno por defecto para cada dimension sin el. */
export interface SelectorEfectivo {
  fieldName: string;
  tipo: PickerKind;
  etiqueta: string;
}

export function selectoresEfectivos(
  instance: ObjectInstance,
  settings: FiltersPanelSettings | undefined,
  fieldKinds: Record<string, string>,
): SelectorEfectivo[] {
  const porCampo = new Map(settings?.pickers.map((s) => [s.fieldName, s]) ?? []);
  return instance.binding.dimensions.map(fieldKey).map((fieldName) => {
    const configurado = porCampo.get(fieldName);
    return {
      fieldName,
      tipo: configurado?.tipo ?? defaultPicker(fieldKinds[fieldName] ?? ''),
      etiqueta: configurado?.etiqueta ?? fieldName.split('.').pop() ?? fieldName,
    };
  });
}
