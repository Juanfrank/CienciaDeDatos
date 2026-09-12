import type { ObjectInstance } from '../registry/types';
import { fieldKey } from '../registry/viewModel';

/**
 * Panel de filtros — objeto visual de categoria `filtro`, seccion 4.4.
 *
 * Lo que existia era el SEGMENTADOR: una dimension, una lista de pastillas. Un modulo que
 * necesitara filtrar por distrito, materia y periodo gastaba tres celdas de la rejilla en tres
 * objetos identicos salvo por el campo, y las tres se veian distintas de las de al lado porque
 * cada una traia su propia cabecera.
 *
 * El panel agrupa de 1 a 10 dimensiones y deja elegir COMO se filtra cada una. El tipo de
 * selector no es cosmetico: con doce valores, pastillas ocupan media pantalla y un desplegable
 * cabe en una linea; con doscientos, lo unico usable es una busqueda. Y una fecha no se filtra
 * como un texto — se filtra por un dia o por un intervalo.
 *
 * Sigue valiendo lo de siempre: la seleccion vive en la query string (4.11), no en estado local,
 * asi que un panel con seis filtros puestos es una URL que se comparte y se marca.
 */

export const TIPOS_DE_SELECTOR = [
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

export type TipoDeSelector = (typeof TIPOS_DE_SELECTOR)[number];

/** Los que EXIGEN una dimension de fecha. Sobre un texto no significan nada. */
export const SELECTORES_DE_FECHA: TipoDeSelector[] = ['calendario', 'rango-de-fechas'];

/**
 * Los tipos de columna que cuentan como fecha.
 *
 * Se enumeran porque cada conector los nombra a su manera y esta lista es el unico sitio donde
 * eso se traduce. `desconocido` NO esta: es lo que devuelve un dataset que el job aun no ha
 * poblado, y ahi la validacion se abstiene en vez de adivinar.
 */
const TIPOS_DE_FECHA = new Set(['date', 'datetime', 'timestamp', 'fecha']);

export const esTipoDeFecha = (tipo: string): boolean => TIPOS_DE_FECHA.has(tipo.toLowerCase());

export interface SelectorDeDimension {
  /** Clave de la dimension, `Tabla.Campo`. Tiene que ser una de las mapeadas en el binding. */
  campo: string;
  tipo: TipoDeSelector;
  /** Rotulo. Sin el, se usa el nombre del campo. */
  etiqueta?: string;
}

export interface ConfiguracionDePanelDeFiltros {
  selectores: SelectorDeDimension[];
}

export const MAX_DIMENSIONES_DEL_PANEL = 10;

/**
 * El selector por defecto de una dimension.
 *
 * Existe para que anadir una dimension al panel NO obligue a elegir nada: se pone el que casi
 * siempre es correcto y se cambia si no lo es. Un editor que exige decidir siete cosas antes de
 * ver algo en pantalla es un editor que nadie usa.
 */
export function selectorPorDefecto(tipoDeColumna: string): TipoDeSelector {
  return esTipoDeFecha(tipoDeColumna) ? 'rango-de-fechas' : 'pastillas';
}

export interface ProblemaDeSelector {
  campo: string;
  problema: string;
}

/**
 * Valida los selectores contra las dimensiones mapeadas y sus tipos.
 *
 * `tiposPorCampo` puede no traer un campo: entonces su tipo es desconocido y la comprobacion de
 * fecha se salta. Es deliberado — ver el comentario de `TIPOS_DE_FECHA`.
 */
export function validarPanelDeFiltros(
  instance: ObjectInstance,
  configuracion: ConfiguracionDePanelDeFiltros | undefined,
  tiposPorCampo: Record<string, string>,
): ProblemaDeSelector[] {
  const problemas: ProblemaDeSelector[] = [];
  const dimensiones = instance.binding.dimensions.map(fieldKey);
  const selectores = configuracion?.selectores ?? [];

  const vistos = new Set<string>();
  for (const selector of selectores) {
    if (!dimensiones.includes(selector.campo)) {
      problemas.push({
        campo: selector.campo,
        problema:
          `'${selector.campo}' no esta entre las dimensiones mapeadas de este panel. ` +
          `Mapeadas: ${dimensiones.join(', ') || 'ninguna'}.`,
      });
      continue;
    }

    if (vistos.has(selector.campo)) {
      problemas.push({
        campo: selector.campo,
        problema: `'${selector.campo}' tiene mas de un selector. Cada dimension lleva uno.`,
      });
    }
    vistos.add(selector.campo);

    if (!(TIPOS_DE_SELECTOR as readonly string[]).includes(selector.tipo)) {
      problemas.push({
        campo: selector.campo,
        problema: `'${String(selector.tipo)}' no es un tipo de selector.`,
      });
      continue;
    }

    const tipoDeColumna = tiposPorCampo[selector.campo];
    if (
      SELECTORES_DE_FECHA.includes(selector.tipo) &&
      tipoDeColumna !== undefined &&
      !esTipoDeFecha(tipoDeColumna)
    ) {
      problemas.push({
        campo: selector.campo,
        problema:
          `El selector '${selector.tipo}' necesita una dimension de fecha, y ` +
          `'${selector.campo}' es de tipo '${tipoDeColumna}'.`,
      });
    }
  }

  return problemas;
}

/**
 * Los selectores efectivos: los configurados, mas uno por defecto para cada dimension sin el.
 *
 * Que esto exista es lo que hace que un panel recien creado FUNCIONE. Sin ello, una dimension
 * mapeada y no configurada seria una dimension invisible: el peor fallo posible en un filtro,
 * porque quien mira cree que esta viendo el total.
 */
export interface SelectorEfectivo {
  campo: string;
  tipo: TipoDeSelector;
  etiqueta: string;
}

export function selectoresEfectivos(
  instance: ObjectInstance,
  configuracion: ConfiguracionDePanelDeFiltros | undefined,
  tiposPorCampo: Record<string, string>,
): SelectorEfectivo[] {
  const porCampo = new Map(configuracion?.selectores.map((s) => [s.campo, s]) ?? []);
  return instance.binding.dimensions.map(fieldKey).map((campo) => {
    const configurado = porCampo.get(campo);
    return {
      campo,
      tipo: configurado?.tipo ?? selectorPorDefecto(tiposPorCampo[campo] ?? ''),
      etiqueta: configurado?.etiqueta ?? campo.split('.').pop() ?? campo,
    };
  });
}
