import type { FieldRef } from '@app/data-contracts';
import type { AccessScope } from './AccessScope';

/** Organizacion general de modulos — seccion 4.1.1 del contrato de ingenieria. */

export type NavNode = FolderNode | ModuleLeaf;

export interface FolderNode {
  id: string;
  type: 'folder';
  name: string;
  icon?: string;
  /** Carpetas y/o modulos, en cualquier combinacion y sin limite de profundidad. */
  children: NavNode[];
  /**
   * Ambito de acceso propio de la carpeta (4.10.6). Se hereda por todo lo que contiene,
   * salvo un override mas especifico en un nivel inferior. Agrupar modulos bajo una
   * carpeta con ambito propio es, en la practica, aplicar esa restriccion a todos ellos
   * de una sola vez.
   */
  scope?: AccessScope;
  /*
   * Oculta: sigue existiendo y sigue en el arbol, pero no se le dibuja a nadie.
   *
   * No es un permiso ni un borrado. Es lo que hace falta para retirar una carpeta de la vista
   * mientras se reorganiza, sin mover nada de sitio —mover cambia el ambito de lo que contiene
   * (4.1.2)— y sin mandarla a la papelera, que es una decision mucho mas grande.
   */
  hidden?: boolean;
}

export interface ModuleRef {
  moduleId: string;
  /** Slug estable usado en la URL: /m/{slug} (4.11). */
  slug: string;
  name: string;
  icon?: string;
}

export interface ModuleLeaf {
  id: string;
  type: 'module';
  moduleRef: ModuleRef;
  /** Oculto: igual que en una carpeta. No se dibuja, pero sigue estando. */
  hidden?: boolean;
}

export const isFolder = (node: NavNode): node is FolderNode => node.type === 'folder';
export const isModule = (node: NavNode): node is ModuleLeaf => node.type === 'module';

/** Ruta de ancestros de un modulo en la organizacion general, desde la raiz hasta el modulo. */
export function findModulePath(tree: NavNode[], moduleId: string): FolderNode[] | null {
  for (const node of tree) {
    if (isModule(node) && node.moduleRef.moduleId === moduleId) return [];
    if (isFolder(node)) {
      const sub = findModulePath(node.children, moduleId);
      if (sub !== null) return [node, ...sub];
    }
  }
  return null;
}

/** Busca un nodo por su id en cualquier nivel del arbol. */
export function findNode(tree: NavNode[], nodeId: string): NavNode | null {
  for (const node of tree) {
    if (node.id === nodeId) return node;
    if (isFolder(node)) {
      const encontrado = findNode(node.children, nodeId);
      if (encontrado) return encontrado;
    }
  }
  return null;
}

/** Todos los ids de modulo contenidos en un nodo, recursivamente (el nodo incluido). */
export function collectModuleIds(node: NavNode): string[] {
  if (isModule(node)) return [node.moduleRef.moduleId];
  return node.children.flatMap(collectModuleIds);
}

/** Profundidad maxima del arbol, para que la interfaz pueda advertir sobre navegabilidad (4.1.1). */
export function maxDepth(tree: NavNode[]): number {
  let max = 0;
  for (const node of tree) {
    const depth = isFolder(node) ? 1 + maxDepth(node.children) : 1;
    if (depth > max) max = depth;
  }
  return max;
}

/** Dimensiones referenciadas por cualquier ambito del arbol, para validarlas contra getSchema(). */
export function collectScopedDimensions(tree: NavNode[]): FieldRef[] {
  const salida: FieldRef[] = [];
  for (const node of tree) {
    if (isFolder(node)) {
      for (const r of node.scope?.restrictions ?? []) salida.push(r.dimension);
      salida.push(...collectScopedDimensions(node.children));
    }
  }
  return salida;
}
