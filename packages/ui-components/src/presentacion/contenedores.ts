import type { ObjectInstance } from '../registry/types';
import {
  CONEXION_POR_DEFECTO,
  CUADRO_DE_TEXTO_POR_DEFECTO,
  FORMA_POR_DEFECTO,
  LINEA_DIVISORIA_POR_DEFECTO,
  TITULO_DE_SECCION_POR_DEFECTO,
  type ConfiguracionDeElemento,
  type IdDeElemento,
  esElemento,
} from './elementos';

/** Contenedores: objetos que agrupan a otros objetos. */

/** Posicion dentro de una rejilla, igual que `GridPosition` de module-model. */
export interface PosicionEnRejilla {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Un objeto dentro de un contenedor. */
export interface ItemAnidado {
  id: string;
  instance: ObjectInstance;
  position: PosicionEnRejilla;
}

/** Un panel de contenido. */
export interface PanelDeContenedor {
  panelId: string;
  /** Rotulo de la pestana. Se ignora en los contenedores de un solo panel. */
  nombre: string;
  items: ItemAnidado[];
}

/* ── Ejes, lados y tamanos ─────────────────────────────────────────────────────────────────── */

/** El eje por el que se desplaza un contenedor desplazable. UNO, nunca los dos. */
export const EJES = ['x', 'y'] as const;
export type Eje = (typeof EJES)[number];

/* ── Configuracion por tipo ────────────────────────────────────────────────────────────────── */

export interface ConfiguracionDeContenedorSimple {
  /** Columnas de la rejilla interna. Menos que las doce de fuera, porque el ancho tambien es menor. */
  gridColumns?: number;
}

export interface ConfiguracionDeContenedorDesplazable extends ConfiguracionDeContenedorSimple {
  eje?: Eje;
}

/** Contenedor ampliable: ensena una parte y se abre a una ventana con su propia rejilla. */
export interface ConfiguracionDeContenedorAmpliable extends ConfiguracionDeContenedorSimple {
  /** Columnas de la rejilla de la ventana ampliada. */
  columnasAmpliado?: number;
  /** Texto del control que amplia. */
  textoDeAmpliar?: string;
}

export interface ConfiguracionDeContenedorConPestanas extends ConfiguracionDeContenedorSimple {
  /** Que pestana se ve al abrir. Si el id no existe, la primera. */
  pestanaInicial?: string;
}

export interface ContainerSettings {
  /**
   * El contenido. Una lista de paneles para TODOS los tipos; los que no tienen pestanas usan el
   * primero.
   */
  panels?: PanelDeContenedor[];
  simple?: ConfiguracionDeContenedorSimple;
  desplazable?: ConfiguracionDeContenedorDesplazable;
  ampliable?: ConfiguracionDeContenedorAmpliable;
  pestanas?: ConfiguracionDeContenedorConPestanas;
}

export const CONTENEDORES = [
  'contenedor-simple',
  'contenedor-desplazable',
  'contenedor-ampliable',
  'contenedor-con-pestanas',
] as const;
export type IdDeContenedor = (typeof CONTENEDORES)[number];

export const esContenedor = (objectId: string): objectId is IdDeContenedor =>
  (CONTENEDORES as readonly string[]).includes(objectId);

export const COLUMNAS_INTERNAS_POR_DEFECTO = 6;

export const PANEL_VACIO = (n = 1): PanelDeContenedor => ({
  panelId: `p${n}`,
  nombre: `Pestana ${n}`,
  items: [],
});

/** Los paneles de un contenedor, siempre al menos uno. */
export function panelesDe(config: ContainerSettings | undefined): PanelDeContenedor[] {
  const panels = config?.panels ?? [];
  return panels.length > 0 ? panels : [PANEL_VACIO()];
}

/** Todas las instancias anidadas de un contenedor, para los avisos de deprecacion y la validacion. */
export function instanciasAnidadas(config: ContainerSettings | undefined): ObjectInstance[] {
  return panelesDe(config).flatMap((p) => p.items.map((i) => i.instance));
}

/* ── Validacion ────────────────────────────────────────────────────────────────────────────── */

export interface ProblemaDeContenedor {
  slot: string;
  issue: string;
}

/** Lo que un contenedor tiene que cumplir antes de guardarse. */
export function validarContenedor(
  itemId: string,
  instance: { objectId: string; configuracion?: unknown },
): ProblemaDeContenedor[] {
  if (!esContenedor(instance.objectId)) return [];
  const config = (instance.configuracion ?? {}) as ContainerSettings;
  const problems: ProblemaDeContenedor[] = [];
  const gridColumns = columnasDe(instance.objectId, config);

  const panels = config.panels ?? [];
  if (instance.objectId === 'contenedor-con-pestanas' && panels.length < 2) {
    problems.push({
      slot: `contenedor.${itemId}`,
      issue:
        'Un contenedor con pestanas necesita al menos dos. Con una sola, la barra de pestanas ' +
        'ocupa sitio sin ofrecer a donde ir: eso es un contenedor simple.',
    });
  }

  const ids = new Set<string>();
  for (const panel of panels) {
    if (ids.has(panel.panelId)) {
      problems.push({
        slot: `contenedor.${itemId}.${panel.panelId}`,
        issue: `Hay dos paneles con el id '${panel.panelId}'. El id identifica a cual se cambia.`,
      });
    }
    ids.add(panel.panelId);

    for (const item of panel.items) {
      if (item.position.w < 1 || item.position.h < 1) {
        problems.push({
          slot: `contenedor.${itemId}.${item.id}`,
          issue: 'Un objeto de ancho o alto cero no se puede ver ni seleccionar.',
        });
      }
      if (item.position.x < 0 || item.position.x + item.position.w > gridColumns) {
        problems.push({
          slot: `contenedor.${itemId}.${item.id}`,
          issue: `Se sale de las ${gridColumns} columnas del contenedor.`,
        });
      }
    }

    for (let i = 0; i < panel.items.length; i += 1) {
      for (let j = i + 1; j < panel.items.length; j += 1) {
        const a = panel.items[i];
        const b = panel.items[j];
        if (a && b && seSolapanEnRejilla(a.position, b.position)) {
          problems.push({
            slot: `contenedor.${itemId}.${a.id}`,
            issue: `Se solapa con '${b.id}' dentro del contenedor.`,
          });
        }
      }
    }
  }

  if (instance.objectId === 'contenedor-desplazable') {
    const eje = config.desplazable?.eje;
    if (eje !== undefined && !(EJES as readonly string[]).includes(eje)) {
      problems.push({
        slot: `contenedor.${itemId}`,
        issue: `'${String(eje)}' no es un eje. Se desplaza por X o por Y, nunca por los dos.`,
      });
    }
  }

  return problems;
}

export const seSolapanEnRejilla = (a: PosicionEnRejilla, b: PosicionEnRejilla): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Las columnas de la rejilla interna de un contenedor, sea cual sea su tipo. */
export function columnasDe(objectId: string, config: ContainerSettings | undefined): number {
  const propia =
    config?.simple?.gridColumns ??
    config?.desplazable?.gridColumns ??
    config?.ampliable?.gridColumns ??
    config?.pestanas?.gridColumns;
  return Math.max(1, Math.round(propia ?? COLUMNAS_INTERNAS_POR_DEFECTO));
}

/* ── Lo que trae un objeto recien puesto ───────────────────────────────────────────────────── */

/** La configuracion inicial de un elemento o un contenedor. */
export function configuracionInicial(
  objectId: string,
):
  | ({ objectId: IdDeContenedor } & ContainerSettings)
  | ({ objectId: IdDeElemento } & ConfiguracionDeElemento)
  | undefined {
  if (esElemento(objectId)) {
    switch (objectId) {
      case 'cuadro-de-texto':
        return { objectId, cuadroDeTexto: CUADRO_DE_TEXTO_POR_DEFECTO };
      case 'titulo-de-seccion':
        return { objectId, tituloDeSeccion: TITULO_DE_SECCION_POR_DEFECTO };
      case 'linea-divisoria':
        return { objectId, lineaDivisoria: LINEA_DIVISORIA_POR_DEFECTO };
      case 'forma':
        return { objectId, forma: FORMA_POR_DEFECTO };
      case 'conexion':
        return { objectId, conexion: CONEXION_POR_DEFECTO };
    }
  }

  if (!esContenedor(objectId)) return undefined;

  // El de pestanas nace con DOS: su validacion exige al menos dos, asi que nacer con una lo haria
  // nacer roto — y el editor lo marcaria antes de que nadie hubiera hecho nada mal.
  const panels =
    objectId === 'contenedor-con-pestanas' ? [PANEL_VACIO(1), PANEL_VACIO(2)] : [PANEL_VACIO()];

  switch (objectId) {
    case 'contenedor-desplazable':
      return { objectId, panels, desplazable: { eje: 'y' } };
    case 'contenedor-ampliable':
      return { objectId, panels, ampliable: { columnasAmpliado: 12, textoDeAmpliar: 'Ampliar' } };
    case 'contenedor-con-pestanas':
      return { objectId, panels, pestanas: { pestanaInicial: 'p1' } };
    default:
      return { objectId, panels };
  }
}
