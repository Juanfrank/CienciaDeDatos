import type { DanglingPackageNode, ModulePackage } from './ModulePackage';
import {
  type FolderNode,
  type NavNode,
  collectModuleIds,
  findNode,
  isFolder,
  isModule,
} from './NavigationTree';
import type { Team } from './Team';

/**
 * Construccion de la vista de navegacion de una persona — secciones 4.1.3 y 4.10.6.
 *
 * Dos reglas gobiernan este modulo:
 *
 *  1. Conceder acceso a una carpeta es conceder acceso a TODO lo que contiene. Las carpetas
 *     son la unidad practica de administracion de permisos, no solo de organizacion visual.
 *  2. Un paquete visual no puede "colar" accesos. El backend valida, al construir la vista,
 *     que cada nodo del paquete corresponda a algo efectivamente concedido en la
 *     organizacion general; si no lo esta, el paquete simplemente NO lo muestra.
 */

/** Ids de modulo efectivamente concedidos a un equipo por sus grantedNodes. */
export function accessibleModuleIds(generalTree: NavNode[], team: Team): Set<string> {
  const ids = new Set<string>();
  for (const nodeId of team.grantedNodes) {
    const node = findNode(generalTree, nodeId);
    // Un grantedNode que ya no existe en el arbol se ignora en silencio para la persona
    // usuaria (falla cerrado) pero se reporta al Administrador via findDanglingGrants.
    if (!node) continue;
    for (const moduleId of collectModuleIds(node)) ids.add(moduleId);
  }
  return ids;
}

/** grantedNodes que apuntan a nodos inexistentes: se señalan al Administrador, no se ocultan. */
export function findDanglingGrants(generalTree: NavNode[], team: Team): string[] {
  return team.grantedNodes.filter((nodeId) => findNode(generalTree, nodeId) === null);
}

/** Todos los ids de modulo presentes en la organizacion general. */
function allModuleIds(tree: NavNode[]): Set<string> {
  return new Set(tree.flatMap(collectModuleIds));
}

/** Poda el arbol general dejando solo lo concedido. Una carpeta sobrevive si algo suyo sobrevive. */
function pruneGeneralTree(tree: NavNode[], accessible: Set<string>): NavNode[] {
  const salida: NavNode[] = [];
  for (const node of tree) {
    if (isModule(node)) {
      if (accessible.has(node.moduleRef.moduleId)) salida.push(node);
      continue;
    }
    const children = pruneGeneralTree(node.children, accessible);
    if (children.length > 0) salida.push({ ...node, children });
  }
  return salida;
}

export interface NavigationView {
  /** Arbol que se muestra a la persona usuaria. */
  tree: NavNode[];
  /** true si proviene de un paquete visual asignado, false si es la organizacion general podada. */
  fromPackage: boolean;
  /**
   * Nodos del paquete que referencian modulos no concedidos o inexistentes. La interfaz debe
   * señalarlos EXPLICITAMENTE al Administrador, no ocultarlos sin aviso (4.1.3).
   */
  dangling: DanglingPackageNode[];
}

export interface BuildNavigationViewInput {
  /** La organizacion general: unica fuente de verdad sobre que existe y quien lo administra. */
  generalTree: NavNode[];
  team: Team;
  /** Paquete asignado al equipo, si lo hay. */
  pkg?: ModulePackage;
}

/**
 * Construye la vista de navegacion de un equipo.
 *
 * Sin paquete asignado, el equipo ve la organizacion general tal cual, limitada a lo que sus
 * grantedNodes conceden. Con paquete, ve el arbol de presentacion del paquete — pero filtrado
 * contra esos mismos grantedNodes, de modo que reagrupar nunca concede.
 */
export function buildNavigationView(input: BuildNavigationViewInput): NavigationView {
  const { generalTree, team, pkg } = input;
  const accesibles = accessibleModuleIds(generalTree, team);

  if (!pkg) {
    return { tree: pruneGeneralTree(generalTree, accesibles), fromPackage: false, dangling: [] };
  }

  const existentes = allModuleIds(generalTree);
  const dangling: DanglingPackageNode[] = [];

  const filtrar = (nodes: NavNode[]): NavNode[] => {
    const salida: NavNode[] = [];
    for (const node of nodes) {
      if (isModule(node)) {
        const moduleId = node.moduleRef.moduleId;
        if (accesibles.has(moduleId)) {
          salida.push(node);
        } else {
          // Falla de forma segura: se registra para el Administrador y NO se muestra.
          dangling.push({
            nodeId: node.id,
            moduleId,
            reason: existentes.has(moduleId)
              ? 'fuera-de-lo-concedido'
              : 'no-existe-en-organizacion-general',
          });
        }
        continue;
      }
      const children = filtrar(node.children);
      // Una carpeta visual que se queda sin contenido accesible no se muestra vacia.
      if (children.length > 0) salida.push({ ...(node as FolderNode), children });
    }
    return salida;
  };

  return { tree: filtrar(pkg.visualTree), fromPackage: true, dangling };
}

/**
 * Comprueba si una persona puede ver un modulo concreto.
 *
 * Se resuelve SIEMPRE contra la organizacion general y los grantedNodes del equipo, jamas
 * contra el paquete: el paquete decide como se presenta lo accesible, nunca que es accesible.
 */
export function canTeamAccessModule(generalTree: NavNode[], team: Team, moduleId: string): boolean {
  return accessibleModuleIds(generalTree, team).has(moduleId);
}

/** Carpetas de la organizacion general que llevan ambito propio, para el panel de administracion. */
export function foldersWithScope(tree: NavNode[]): FolderNode[] {
  const salida: FolderNode[] = [];
  for (const node of tree) {
    if (!isFolder(node)) continue;
    if (node.scope) salida.push(node);
    salida.push(...foldersWithScope(node.children));
  }
  return salida;
}
