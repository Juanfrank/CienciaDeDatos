import {
  type ConfiguracionDeContenedor,
  type ObjectInstance,
  esContenedor,
  instanciasAnidadas,
} from '@app/ui-components';
import type { GridPosition } from './grid';

/**
 * Definicion de un modulo — secciones 4.1 y 4.2.
 *
 * Es el documento que produce el editor y consume el renderizador. Contiene QUE objetos hay,
 * DONDE estan y CONTRA QUE dataset se enlazan; nunca una consulta, ni una cadena de conexion,
 * ni nada que revele la fuente activa.
 */

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
  createdAt: string;
  updatedAt: string;
}

export const moduleUrl = (module: Pick<ModuleDefinition, 'slug'>, page?: Pick<ModulePage, 'slug'>): string =>
  page ? `/m/${module.slug}/${page.slug}` : `/m/${module.slug}`;

/**
 * Todos los datasetId que un modulo consume, para declararlos en su module.contract.ts (3.3).
 *
 * Se filtra el vacio: un elemento o un contenedor no se enlaza a nada, y su `datasetId` es la
 * cadena vacia. Pedirla al cache devolveria «no esta poblado» para un dataset que no existe, y el
 * modulo entero apareceria degradado por culpa de un cuadro de texto.
 */
export function datasetsConsumedBy(module: ModuleDefinition): string[] {
  return [
    ...new Set(instancesOf(module).map((i) => i.binding.datasetId).filter((id) => id !== '')),
  ].sort();
}

/**
 * Todas las instancias del modulo, para comprobar avisos de deprecacion (4.5).
 *
 * Incluye las ANIDADAS dentro de un contenedor. Un grafico no deja de estar desplegado por vivir
 * dentro de una pestana, y si se omitiera aqui, deprecar su version no avisaria a los modulos que
 * lo usan — que es exactamente lo que la politica de 4.5 existe para evitar.
 */
export function instancesOf(module: ModuleDefinition): ObjectInstance[] {
  const recorrer = (instance: ObjectInstance): ObjectInstance[] => [
    instance,
    ...instanciasAnidadas(
      esContenedor(instance.objectId)
        ? (instance.configuracion as ConfiguracionDeContenedor | undefined)
        : undefined,
    ).flatMap(recorrer),
  ];
  return module.pages.flatMap((p) => p.items.flatMap((i) => recorrer(i.instance)));
}

export function findPage(module: ModuleDefinition, pageSlug?: string): ModulePage | undefined {
  if (!pageSlug) return module.pages[0];
  return module.pages.find((p) => p.slug === pageSlug);
}
