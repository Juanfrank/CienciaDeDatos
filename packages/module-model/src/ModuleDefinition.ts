import {
  type ContainerSettings,
  type ObjectInstance,
  isContainer,
  nestedInstances,
} from '@app/ui-components';
import type { GridPosition } from './grid';

/** Definicion de un modulo — secciones 4.1 y 4.2. */

/**
 * Ciclo de vida de 4.1: los borradores son personales; publicar a nivel institucional requiere
 * aprobacion de un Administrador (matriz de 4.10.1).
 */
export type ModuleStatus = 'borrador' | 'pendiente-de-aprobacion' | 'publicado';

export interface GridItem {
  id: string;
  instance: ObjectInstance;
  position: GridPosition;
}

export interface ModulePage {
  pageId: string;
  /** Slug de la pagina: /m/{module-slug}/{page-slug} (4.11). */
  slug: string;
  name: string;
  items: GridItem[];
}

export interface ModuleDefinition {
  moduleId: string;
  /** Slug legible y estable, aunque el objeto interno se reversione (4.11). */
  slug: string;
  name: string;
  icon?: string;
  /** Para que sirve, en una frase. Se lee en la lista y en la cabecera del propio modulo. */
  description?: string;
  status: ModuleStatus;
  /**
   * Autor de un modulo personal o borrador. Los modulos publicados a nivel institucional no
   * pertenecen a una persona: pertenecen a la institucion.
   */
  ownerUserId?: string;
  pages: ModulePage[];
  /**
   * Version de la definicion. Todo objeto compartido esta versionado y nunca se modifica uno
   * publicado: se publica una version nueva (principio 8).
   */
  version: number;
  /*
   * Lo que se puede hacer con el modulo, mas alla de mirarlo.
   *
   * Ausente o con una clave ausente significa ENCENDIDO: un modulo nuevo trae todo, y la
   * configuracion sirve para apagar lo que no encaja —un tablero que no debe incrustarse fuera,
   * uno cuyos datos no deben exportarse—. Guardar solo lo apagado mantiene el valor por defecto
   * en un sitio, aqui, en vez de repetido en cada modulo del almacen.
   */
  options?: Partial<Record<ModuleOption, boolean>>;
  /*
   * Con que filtros abre el modulo cuando nadie pide otra cosa.
   *
   * No es un ambito: no restringe lo que se puede ver, solo elige por donde se empieza a mirar.
   * Quien los quite los quita, y entonces ve todo lo que su ambito le permite.
   */
  defaultFilters?: DefaultFilter[];
  createdAt: string;
  updatedAt: string;
}

/** Un filtro por defecto: el campo tal como viaja en la URL, y con que valores abre. */
export interface DefaultFilter {
  /** `Tabla.Campo`, la misma clave que usa la query string (4.11). */
  field: string;
  values: string[];
}

/** Lo que un modulo puede ofrecer. Cada una se dibuja en la barra del modulo. */
export const MODULE_OPTIONS = [
  'personalizacion',
  'marcadores',
  'exportacion',
  'alertas',
  'embebido',
] as const;

export type ModuleOption = (typeof MODULE_OPTIONS)[number];

/**
 * Si una opcion esta encendida.
 *
 * Ausente es encendida, y por eso se pregunta siempre por aqui y nunca leyendo `options` a mano:
 * `modulo.options?.marcadores` da `undefined` en un modulo que nunca se configuro, y eso leido
 * como booleano apagaria los marcadores de todos los modulos existentes.
 */
export function moduleOptionOn(
  module: Pick<ModuleDefinition, 'options'>,
  option: ModuleOption,
): boolean {
  return module.options?.[option] !== false;
}

export const moduleUrl = (module: Pick<ModuleDefinition, 'slug'>, page?: Pick<ModulePage, 'slug'>): string =>
  page ? `/m/${module.slug}/${page.slug}` : `/m/${module.slug}`;

/** Todos los datasetId que un modulo consume, para declararlos en su module.contract.ts (3.3). */
export function datasetsConsumedBy(module: ModuleDefinition): string[] {
  return [
    ...new Set(instancesOf(module).map((i) => i.binding.datasetId).filter((id) => id !== '')),
  ].sort();
}

/** Todas las instancias del modulo, para comprobar avisos de deprecacion (4.5). */
export function instancesOf(module: ModuleDefinition): ObjectInstance[] {
  const recorrer = (instance: ObjectInstance): ObjectInstance[] => [
    instance,
    ...nestedInstances(
      isContainer(instance.objectId)
        ? (instance.settings as ContainerSettings | undefined)
        : undefined,
    ).flatMap(recorrer),
  ];
  return module.pages.flatMap((p) => p.items.flatMap((i) => recorrer(i.instance)));
}

export function findPage(module: ModuleDefinition, pageSlug?: string): ModulePage | undefined {
  if (!pageSlug) return module.pages[0];
  return module.pages.find((p) => p.slug === pageSlug);
}
