import type { ObjectInstance } from '../registry/types';
import {
  DEFAULT_CONNECTION,
  DEFAULT_BOX_TEXT,
  DEFAULT_SHAPE,
  DEFAULT_LINE_DIVIDER,
  DEFAULT_TITLE_SECTION,
  type ElementSettings,
  type ElementId,
  isElement,
} from './elements';

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
export interface ContainerPanel {
  panelId: string;
  /** Rotulo de la pestana. Se ignora en los contenedores de un solo panel. */
  nombre: string;
  items: ItemAnidado[];
}

/* ── Ejes, lados y tamanos ─────────────────────────────────────────────────────────────────── */

/** El eje por el que se desplaza un contenedor desplazable. UNO, nunca los dos. */
export const AXES = ['x', 'y'] as const;
export type Axis = (typeof AXES)[number];

/* ── Configuracion por tipo ────────────────────────────────────────────────────────────────── */

export interface SimpleSettingsContainer {
  /** Columnas de la rejilla interna. Menos que las doce de fuera, porque el ancho tambien es menor. */
  gridColumns?: number;
}

export interface ScrollableSettingsContainer extends SimpleSettingsContainer {
  axis?: Axis;
}

/** Contenedor ampliable: ensena una parte y se abre a una ventana con su propia rejilla. */
export interface ExpandableSettingsContainer extends SimpleSettingsContainer {
  /** Columnas de la rejilla de la ventana ampliada. */
  columnasAmpliado?: number;
  /** Texto del control que amplia. */
  textoDeAmpliar?: string;
}

export interface TabContainerSettings extends SimpleSettingsContainer {
  /** Que pestana se ve al abrir. Si el id no existe, la primera. */
  initialTab?: string;
}

export interface ContainerSettings {
  /**
   * El contenido. Una lista de paneles para TODOS los tipos; los que no tienen pestanas usan el
   * primero.
   */
  panels?: ContainerPanel[];
  simple?: SimpleSettingsContainer;
  scrollable?: ScrollableSettingsContainer;
  expandable?: ExpandableSettingsContainer;
  tabs?: TabContainerSettings;
}

export const CONTAINERS = [
  'contenedor-simple',
  'contenedor-desplazable',
  'contenedor-ampliable',
  'contenedor-con-pestanas',
] as const;
export type ContainerId = (typeof CONTAINERS)[number];

export const isContainer = (objectId: string): objectId is ContainerId =>
  (CONTAINERS as readonly string[]).includes(objectId);

export const COLUMNAS_INTERNAS_POR_DEFECTO = 6;

export const EMPTY_PANEL = (n = 1): ContainerPanel => ({
  panelId: `p${n}`,
  nombre: `Pestana ${n}`,
  items: [],
});

/** Los paneles de un contenedor, siempre al menos uno. */
export function panelsOf(config: ContainerSettings | undefined): ContainerPanel[] {
  const panels = config?.panels ?? [];
  return panels.length > 0 ? panels : [EMPTY_PANEL()];
}

/** Todas las instancias anidadas de un contenedor, para los avisos de deprecacion y la validacion. */
export function nestedInstances(config: ContainerSettings | undefined): ObjectInstance[] {
  return panelsOf(config).flatMap((p) => p.items.map((i) => i.instance));
}

/* ── Validacion ────────────────────────────────────────────────────────────────────────────── */

export interface ContainerProblem {
  slot: string;
  issue: string;
}

/** Lo que un contenedor tiene que cumplir antes de guardarse. */
export function validateContainer(
  itemId: string,
  instance: { objectId: string; settings?: unknown },
): ContainerProblem[] {
  if (!isContainer(instance.objectId)) return [];
  const config = (instance.settings ?? {}) as ContainerSettings;
  const problems: ContainerProblem[] = [];
  const gridColumns = columnsOf(instance.objectId, config);

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
    const axis = config.scrollable?.axis;
    if (axis !== undefined && !(AXES as readonly string[]).includes(axis)) {
      problems.push({
        slot: `contenedor.${itemId}`,
        issue: `'${String(axis)}' no es un eje. Se desplaza por X o por Y, nunca por los dos.`,
      });
    }
  }

  return problems;
}

export const seSolapanEnRejilla = (a: PosicionEnRejilla, b: PosicionEnRejilla): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Las columnas de la rejilla interna de un contenedor, sea cual sea su tipo. */
export function columnsOf(objectId: string, config: ContainerSettings | undefined): number {
  const propia =
    config?.simple?.gridColumns ??
    config?.scrollable?.gridColumns ??
    config?.expandable?.gridColumns ??
    config?.tabs?.gridColumns;
  return Math.max(1, Math.round(propia ?? COLUMNAS_INTERNAS_POR_DEFECTO));
}

/* ── Lo que trae un objeto recien puesto ───────────────────────────────────────────────────── */

/** La configuracion inicial de un elemento o un contenedor. */
export function initialSettings(
  objectId: string,
):
  | ({ objectId: ContainerId } & ContainerSettings)
  | ({ objectId: ElementId } & ElementSettings)
  | undefined {
  if (isElement(objectId)) {
    switch (objectId) {
      case 'cuadro-de-texto':
        return { objectId, textBox: DEFAULT_BOX_TEXT };
      case 'titulo-de-seccion':
        return { objectId, sectionTitle: DEFAULT_TITLE_SECTION };
      case 'linea-divisoria':
        return { objectId, lineDivider: DEFAULT_LINE_DIVIDER };
      case 'forma':
        return { objectId, forma: DEFAULT_SHAPE };
      case 'conexion':
        return { objectId, conexion: DEFAULT_CONNECTION };
    }
  }

  if (!isContainer(objectId)) return undefined;

  // El de pestanas nace con DOS: su validacion exige al menos dos, asi que nacer con una lo haria
  // nacer roto — y el editor lo marcaria antes de que nadie hubiera hecho nada mal.
  const panels =
    objectId === 'contenedor-con-pestanas' ? [EMPTY_PANEL(1), EMPTY_PANEL(2)] : [EMPTY_PANEL()];

  switch (objectId) {
    case 'contenedor-desplazable':
      return { objectId, panels, scrollable: { axis: 'y' } };
    case 'contenedor-ampliable':
      return { objectId, panels, expandable: { columnasAmpliado: 12, textoDeAmpliar: 'Ampliar' } };
    case 'contenedor-con-pestanas':
      return { objectId, panels, tabs: { initialTab: 'p1' } };
    default:
      return { objectId, panels };
  }
}
