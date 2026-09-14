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

/**
 * Las formas de acotar por un campo, mas alla de «pertenece a».
 *
 * Es lo que en Power BI se llama filtrado basico y avanzado y en Tableau «include / exclude» y
 * «wildcard match», reunido en una sola lista: son la misma decision —que se deja pasar— y
 * separarlas en dos pantallas obliga a saber de antemano en cual esta lo que uno busca.
 */
export const FILTER_MODES = [
  /** Pertenece al conjunto elegido. El de siempre. */
  'valores',
  /** No pertenece: se elige lo que se quita. */
  'excluir',
  /** Contiene o empieza por un texto. */
  'texto',
  /** Entre dos limites. Sirve para numeros y para fechas. */
  'rango',
  /** Con valor o sin valor. */
  'vacios',
] as const;

export type FilterMode = (typeof FILTER_MODES)[number];

/** Como se ordenan los valores de un campo en la lista. */
export const VALUE_ORDERS = ['alfabetico', 'frecuencia', 'origen'] as const;

export type ValueOrder = (typeof VALUE_ORDERS)[number];

export interface DimensionPicker {
  /** Clave de la dimension, `Tabla.Campo`. Tiene que ser una de las mapeadas en el binding. */
  fieldName: string;
  tipo: PickerKind;
  /** Rotulo. Sin el, se usa el nombre del campo. */
  etiqueta?: string;
  /**
   * Que formas de acotar ofrece este campo. Sin decirlo, las que tienen sentido por su tipo.
   *
   * Se declara por campo y no para el panel entero porque no todas valen igual: un rango sobre
   * una materia no significa nada, y un «empieza por» sobre un año tampoco.
   */
  modos?: FilterMode[];
  /** Como se ordenan los valores. Sin decirlo, como vengan del dataset. */
  orden?: ValueOrder;
  /** Cuantas filas hay detras de cada valor, junto a el. */
  recuento?: boolean;
  /** Los botones de «todos» y «ninguno». Con dos valores sobran; con cincuenta, no. */
  todos?: boolean;
  /** Empieza plegado. Un panel de diez campos abiertos no se lee de un vistazo. */
  plegado?: boolean;
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

    if (picker.orden !== undefined && !(VALUE_ORDERS as readonly string[]).includes(picker.orden)) {
      problems.push({
        fieldName: picker.fieldName,
        issue: `'${String(picker.orden)}' no es un orden de valores.`,
      });
    }

    /*
     * Un modo que no acota nada no se guarda.
     *
     * «Empieza por» sobre un año y «entre» sobre una materia se dibujan igual de bien y no
     * devuelven lo que quien los usa espera: el primero compara texto sobre un numero, y el
     * segundo ordena alfabeticamente lo que no tiene orden. Es la misma regla que ya se aplica a
     * los selectores de fecha, extendida a los modos.
     */
    const permitidos = columnKind === undefined ? null : modesByDefault(columnKind);
    for (const modo of picker.modos ?? []) {
      if (!(FILTER_MODES as readonly string[]).includes(modo)) {
        problems.push({
          fieldName: picker.fieldName,
          issue: `'${String(modo)}' no es una forma de filtrar.`,
        });
        continue;
      }
      if (permitidos && !permitidos.includes(modo)) {
        problems.push({
          fieldName: picker.fieldName,
          issue:
            `La forma '${modo}' no tiene sentido sobre '${picker.fieldName}', que es de tipo ` +
            `'${columnKind}'. Admite: ${permitidos.join(', ')}.`,
        });
      }
    }
  }

  return problems;
}

/**
 * Los modos que tienen sentido sobre una columna de un tipo dado.
 *
 * «Rango» solo sobre lo que se ordena —numeros y fechas—; «texto» solo sobre lo que es texto. El
 * resto valen siempre. Ofrecer todos en todos los campos llenaria el desplegable de opciones que
 * no acotan nada, que es la manera de que nadie lea ninguna.
 */
export function modesByDefault(columnKind: string): FilterMode[] {
  const kind = columnKind.toLowerCase();
  const esFecha = dateKindIs(kind);
  const esNumero = kind === 'number' || kind === 'numero' || kind === 'int' || kind === 'decimal';
  return [
    'valores',
    'excluir',
    ...(esFecha || esNumero ? ([] as FilterMode[]) : (['texto'] as FilterMode[])),
    ...(esFecha || esNumero ? (['rango'] as FilterMode[]) : ([] as FilterMode[])),
    'vacios',
  ];
}

/** Los selectores efectivos: los configurados, mas uno por defecto para cada dimension sin el. */
export interface SelectorEfectivo {
  fieldName: string;
  tipo: PickerKind;
  etiqueta: string;
  modos: FilterMode[];
  orden: ValueOrder;
  recuento: boolean;
  todos: boolean;
  plegado: boolean;
}

export function effectivePickers(
  instance: ObjectInstance,
  settings: FiltersPanelSettings | undefined,
  fieldKinds: Record<string, string>,
): SelectorEfectivo[] {
  const porCampo = new Map(settings?.pickers.map((s) => [s.fieldName, s]) ?? []);
  return instance.binding.dimensions.map(fieldKey).map((fieldName) => {
    const configurado = porCampo.get(fieldName);
    const columnKind = fieldKinds[fieldName] ?? '';
    const modos = (configurado?.modos ?? []).filter((m) => FILTER_MODES.includes(m));
    return {
      fieldName,
      tipo: configurado?.tipo ?? defaultPicker(columnKind),
      etiqueta: configurado?.etiqueta ?? fieldName.split('.').pop() ?? fieldName,
      // Una lista vacia se trata como «no se dijo»: un campo sin ningun modo no se podria usar,
      // y guardarlo asi seria dejar un filtro que no filtra.
      modos: modos.length > 0 ? modos : modesByDefault(columnKind),
      orden: configurado?.orden ?? 'origen',
      recuento: configurado?.recuento === true,
      todos: configurado?.todos === true,
      plegado: configurado?.plegado === true,
    };
  });
}

/** Un valor de un campo, con cuantas filas hay detras. */
export interface ValueCount {
  valor: string;
  recuento: number;
}

/**
 * Ordena los valores de un campo.
 *
 * `origen` es el orden en que vienen del dataset, que NO es arbitrario: un trimestre viene en
 * orden de trimestre y ordenarlo alfabeticamente lo estropea. Por eso es el de por defecto y
 * alfabetico se pide a proposito — util cuando son nombres de tribunal y se busca uno.
 */
export function orderedValues(valores: ValueCount[], orden: ValueOrder): ValueCount[] {
  if (orden === 'origen') return valores;
  const copia = [...valores];
  if (orden === 'alfabetico') {
    // Con `localeCompare` y no por codigo: en es-DO, «Ñ» va entre la N y la O, y «á» junto a la a.
    copia.sort((a, b) => a.valor.localeCompare(b.valor, 'es'));
    return copia;
  }
  // Por frecuencia, y a igualdad alfabetico: sin el desempate, dos valores con el mismo recuento
  // cambiarian de sitio entre lecturas y la lista bailaria sin que nada hubiera cambiado.
  copia.sort((a, b) => b.recuento - a.recuento || a.valor.localeCompare(b.valor, 'es'));
  return copia;
}
