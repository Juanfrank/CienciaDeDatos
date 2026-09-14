import type { DimensionPicker } from '@app/ui-components';

/**
 * Navegador de pagina — como se pasa de una pagina de un modulo a otra (4.2).
 *
 * Es un objeto visual, pero NO se coloca en el lienzo, y esa diferencia es deliberada. Lo que
 * navega no es la pagina, es el modulo: si viviera dentro de una pagina habria que ponerlo en
 * todas, mantenerlo igual en todas, y la primera vez que alguien lo olvidara en una esa pagina
 * seria un callejon sin salida. Vive en la definicion del modulo y se dibuja alrededor de
 * cualquier pagina que se abra.
 *
 * Es OBLIGATORIO en cuanto hay mas de una pagina. Sin el, las paginas existen en el modelo y solo
 * se alcanzan escribiendo la URL a mano — que es como estaban hasta ahora.
 */
export const NAVIGATOR_KINDS = [
  /** Panel a la izquierda, como el menu lateral de un sistema. */
  'panel-izquierdo',
  /** El mismo panel, al otro lado. */
  'panel-derecho',
  /** Pestanas debajo del contenido, como las hojas de una hoja de calculo. */
  'pestanas-abajo',
  /** Un boton que despliega la lista. Ocupa una linea sea cual sea el numero de paginas. */
  'menu',
] as const;

export type NavigatorKind = (typeof NAVIGATOR_KINDS)[number];

export const NAVIGATOR_IS_PANEL = (tipo: NavigatorKind): boolean =>
  tipo === 'panel-izquierdo' || tipo === 'panel-derecho';

/**
 * Como ocupa el sitio un panel. Solo aplica a los dos paneles laterales.
 *
 * - `grilla`: el panel se queda fijo y el contenido ocupa lo que sobra. Es lo que se espera de un
 *   menu lateral permanente, y lo que se ve en un sistema que se usa todo el dia.
 * - `drawer`: se puede plegar y desplegar; plegado deja solo una franja, y el contenido se
 *   ensancha. Para pantallas donde el ancho es lo escaso.
 * - `overlay`: aparece ENCIMA del contenido y lo tapa mientras esta abierto, sin moverlo. Para
 *   pantallas estrechas, donde robar ancho al contenido lo deja ilegible.
 */
export const PANEL_BEHAVIORS = ['grilla', 'drawer', 'overlay'] as const;

export type PanelBehavior = (typeof PANEL_BEHAVIORS)[number];

export interface PageNavigatorSettings {
  tipo: NavigatorKind;
  /** Solo para los paneles. Los otros dos tipos no ocupan un lado, asi que no tienen que elegir. */
  comportamiento?: PanelBehavior;
  /**
   * Una seccion de filtros DENTRO del panel, con los mismos selectores que el panel de filtros.
   *
   * Es lo que convierte el panel lateral en lo que la gente espera de uno: navegacion arriba y los
   * filtros de busqueda debajo, sin gastar una fila de la rejilla en ellos. Solo en los paneles:
   * en unas pestanas o en un menu no hay donde ponerlos.
   */
  filtros?: NavigatorFilters;
}

export interface NavigatorFilters {
  /** Rotulo de la seccion. Sin el, «Filtros». */
  etiqueta?: string;
  /**
   * Los mismos selectores que el objeto «Panel de filtros», y a proposito.
   *
   * Un filtro que se configura distinto segun donde este es un filtro que se comporta distinto sin
   * que nadie lo haya pedido. Se reusa `DimensionPicker` entero: mismo tipo, mismas reglas sobre
   * que selectores admite una fecha, y la misma validacion contra el esquema.
   */
  pickers: DimensionPicker[];
  /** El dataset del que salen los valores. Sin el no hay de donde sacarlos. */
  datasetId?: string;
}

/** Un navegador recien elegido, con lo minimo para que se dibuje. */
export function navigatorByDefault(tipo: NavigatorKind): PageNavigatorSettings {
  return NAVIGATOR_IS_PANEL(tipo) ? { tipo, comportamiento: 'grilla' } : { tipo };
}

/**
 * Lo que impide publicar un modulo por su navegacion.
 *
 * Se devuelve como lista de motivos y no como booleano porque quien lo lee tiene que poder
 * ARREGLARLO: «no se puede publicar» sin decir que falta obliga a adivinar.
 */
export function navigatorProblems(modulo: {
  pages: { pageId: string }[];
  navigator?: PageNavigatorSettings;
}): string[] {
  if (modulo.pages.length <= 1) {
    // Con una sola pagina no hay a donde navegar. Exigir un navegador seria pedir un menu de una
    // entrada, que ocupa sitio y no lleva a ningun lado.
    return [];
  }
  if (!modulo.navigator) {
    return [
      'Un modulo con mas de una pagina necesita un navegador de pagina: sin el, las paginas solo ' +
        'se alcanzan escribiendo la URL a mano.',
    ];
  }
  if (!NAVIGATOR_KINDS.includes(modulo.navigator.tipo)) {
    return [`«${modulo.navigator.tipo}» no es un tipo de navegador de pagina.`];
  }
  if (
    NAVIGATOR_IS_PANEL(modulo.navigator.tipo) &&
    modulo.navigator.comportamiento !== undefined &&
    !PANEL_BEHAVIORS.includes(modulo.navigator.comportamiento)
  ) {
    return [`«${modulo.navigator.comportamiento}» no es un comportamiento de panel.`];
  }
  return [];
}
