import type { AccessScope } from './AccessScope';
import { type FolderNode, type ModuleRef, type NavNode, isFolder, isModule } from './NavigationTree';
import { type Capability, type PermissionDenial, can, denial } from './permissions';
import type { AppRole } from './Team';

/** Operaciones sobre la organizacion general — seccion 4.1. */

/** Nodo en la papelera. */
export interface TrashedNode {
  node: NavNode;
  deletedAt: string;
  deletedBy: string;
  previousParentId: string | null;
  previousIndex: number;
}

export interface ManagedTree {
  nodes: NavNode[];
  trash: TrashedNode[];
}

export interface Actor {
  userId: string;
  role: AppRole;
}

/** Evento de auditoria de dominio. */
export interface TreeAuditEvent {
  actorId: string;
  action:
    | 'crear-carpeta'
    | 'crear-modulo'
    | 'renombrar'
    | 'mover'
    | 'reordenar'
    | 'enviar-a-papelera'
    | 'restaurar'
    | 'borrar-definitivamente';
  nodeId: string;
  detail: string;
  /**
   * Solo en un movimiento: el ambito propio de la carpeta de origen y el de la de destino.
   * Mover es un cambio ESTRUCTURAL (4.1.2) y el log tiene que dejar ver que el ambito cambio,
   * no solo que algo se movio de sitio.
   */
  scopeBefore?: AccessScope;
  scopeAfter?: AccessScope;
}

export type TreeOperation =
  | { type: 'crear-carpeta'; parentId: string | null; id: string; name: string; icon?: string; scope?: AccessScope }
  | { type: 'crear-modulo'; parentId: string | null; id: string; moduleRef: ModuleRef }
  | { type: 'renombrar'; nodeId: string; name: string }
  | { type: 'mover'; nodeId: string; newParentId: string | null; index?: number }
  | { type: 'reordenar'; nodeId: string; index: number }
  | { type: 'enviar-a-papelera'; nodeId: string }
  | { type: 'restaurar'; trashedNodeId: string }
  | { type: 'borrar-definitivamente'; trashedNodeId: string };

export type TreeOperationResult =
  | { ok: true; tree: ManagedTree; audit: TreeAuditEvent[] }
  | { ok: false; denial: PermissionDenial }
  | { ok: false; error: string };

/** Capacidad que exige cada operacion (matriz de 4.10.1). */
const CAPACIDAD_REQUERIDA: Record<TreeOperation['type'], Capability> = {
  'crear-carpeta': 'reorganizar-arbol-general',
  // Crear un modulo lo puede hacer un Colaborador: nace como borrador y su publicacion
  // institucional es otra operacion, con otra capacidad.
  'crear-modulo': 'crear-editar-modulos-borrador',
  renombrar: 'reorganizar-arbol-general',
  // Mover suena cosmetico pero NO lo es: si la carpeta de destino tiene otro ambito, el modulo
  // hereda ese ambito de inmediato (4.1.2). Por eso esta reservado a Administrador.
  mover: 'reorganizar-arbol-general',
  reordenar: 'reorganizar-arbol-general',
  'enviar-a-papelera': 'crear-editar-modulos-borrador',
  restaurar: 'reorganizar-arbol-general',
  'borrar-definitivamente': 'borrar-definitivamente',
};

const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

/** Localiza un nodo y su carpeta contenedora. */
function locate(
  nodes: NavNode[],
  nodeId: string,
  parent: FolderNode | null = null,
): { node: NavNode; parent: FolderNode | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    if (node.id === nodeId) return { node, parent, index: i };
    if (isFolder(node)) {
      const encontrado = locate(node.children, nodeId, node);
      if (encontrado) return encontrado;
    }
  }
  return null;
}

/** Hijos de una carpeta, o la raiz si parentId es null. */
function childrenOf(tree: ManagedTree, parentId: string | null): NavNode[] | null {
  if (parentId === null) return tree.nodes;
  const destino = locate(tree.nodes, parentId);
  if (!destino || !isFolder(destino.node)) return null;
  return destino.node.children;
}

/** true si `possibleAncestorId` es el nodo o un ancestro de el. */
function isSelfOrAncestor(nodes: NavNode[], nodeId: string, possibleDescendantId: string): boolean {
  const encontrado = locate(nodes, nodeId);
  if (!encontrado) return false;
  if (nodeId === possibleDescendantId) return true;
  if (!isFolder(encontrado.node)) return false;
  return locate(encontrado.node.children, possibleDescendantId) !== null;
}

const describir = (node: NavNode): string =>
  isFolder(node) ? `carpeta '${node.name}'` : `modulo '${node.moduleRef.name}'`;

/** Aplica una operacion sobre el arbol. */
export function applyTreeOperation(
  tree: ManagedTree,
  op: TreeOperation,
  actor: Actor,
): TreeOperationResult {
  const capacidad = CAPACIDAD_REQUERIDA[op.type];
  if (!can(actor.role, capacidad)) {
    return { ok: false, denial: denial(actor.role, capacidad) };
  }

  const siguiente: ManagedTree = clonar(tree);
  const ahora = new Date().toISOString();

  switch (op.type) {
    case 'crear-carpeta': {
      const hijos = childrenOf(siguiente, op.parentId);
      if (!hijos) return { ok: false, error: `La carpeta destino '${op.parentId}' no existe.` };
      if (locate(siguiente.nodes, op.id)) return { ok: false, error: `Ya existe un nodo con id '${op.id}'.` };

      const carpeta: FolderNode = {
        id: op.id,
        type: 'folder',
        name: op.name,
        children: [],
        ...(op.icon ? { icon: op.icon } : {}),
        ...(op.scope ? { scope: op.scope } : {}),
      };
      hijos.push(carpeta);
      return {
        ok: true,
        tree: siguiente,
        audit: [{ actorId: actor.userId, action: 'crear-carpeta', nodeId: op.id, detail: `Creada ${describir(carpeta)}.` }],
      };
    }

    case 'crear-modulo': {
      const hijos = childrenOf(siguiente, op.parentId);
      if (!hijos) return { ok: false, error: `La carpeta destino '${op.parentId}' no existe.` };
      if (locate(siguiente.nodes, op.id)) return { ok: false, error: `Ya existe un nodo con id '${op.id}'.` };

      const hoja: NavNode = { id: op.id, type: 'module', moduleRef: op.moduleRef };
      hijos.push(hoja);
      return {
        ok: true,
        tree: siguiente,
        audit: [{ actorId: actor.userId, action: 'crear-modulo', nodeId: op.id, detail: `Creado ${describir(hoja)}.` }],
      };
    }

    case 'renombrar': {
      const encontrado = locate(siguiente.nodes, op.nodeId);
      if (!encontrado) return { ok: false, error: `El nodo '${op.nodeId}' no existe.` };

      const anterior = isFolder(encontrado.node) ? encontrado.node.name : encontrado.node.moduleRef.name;
      if (isFolder(encontrado.node)) encontrado.node.name = op.name;
      else encontrado.node.moduleRef = { ...encontrado.node.moduleRef, name: op.name };

      return {
        ok: true,
        tree: siguiente,
        audit: [
          {
            actorId: actor.userId,
            action: 'renombrar',
            nodeId: op.nodeId,
            detail: `Renombrado de '${anterior}' a '${op.name}'.`,
          },
        ],
      };
    }

    case 'mover': {
      const encontrado = locate(siguiente.nodes, op.nodeId);
      if (!encontrado) return { ok: false, error: `El nodo '${op.nodeId}' no existe.` };

      // Mover una carpeta dentro de si misma desconectaria esa rama del arbol.
      if (op.newParentId !== null && isSelfOrAncestor(siguiente.nodes, op.nodeId, op.newParentId)) {
        return { ok: false, error: `No se puede mover '${op.nodeId}' dentro de si mismo.` };
      }

      const destino = childrenOf(siguiente, op.newParentId);
      if (!destino) return { ok: false, error: `La carpeta destino '${op.newParentId}' no existe.` };

      const source = encontrado.parent ? encontrado.parent.children : siguiente.nodes;
      const scopeBefore = encontrado.parent?.scope;
      const [extraido] = source.splice(encontrado.index, 1);
      if (!extraido) return { ok: false, error: `No se pudo extraer el nodo '${op.nodeId}'.` };

      const indice = op.index === undefined ? destino.length : Math.max(0, Math.min(op.index, destino.length));
      destino.splice(indice, 0, extraido);

      const carpetaDestino = op.newParentId === null ? null : locate(siguiente.nodes, op.newParentId);
      const scopeAfter =
        carpetaDestino && isFolder(carpetaDestino.node) ? carpetaDestino.node.scope : undefined;

      return {
        ok: true,
        tree: siguiente,
        audit: [
          {
            actorId: actor.userId,
            action: 'mover',
            nodeId: op.nodeId,
            detail:
              `Movido ${describir(extraido)} a ${op.newParentId ?? 'la raiz'}. ` +
              `Es un cambio estructural: el ambito heredado puede haber cambiado (4.1.2).`,
            ...(scopeBefore ? { scopeBefore } : {}),
            ...(scopeAfter ? { scopeAfter } : {}),
          },
        ],
      };
    }

    case 'reordenar': {
      const encontrado = locate(siguiente.nodes, op.nodeId);
      if (!encontrado) return { ok: false, error: `El nodo '${op.nodeId}' no existe.` };

      const hermanos = encontrado.parent ? encontrado.parent.children : siguiente.nodes;
      const [extraido] = hermanos.splice(encontrado.index, 1);
      if (!extraido) return { ok: false, error: `No se pudo extraer el nodo '${op.nodeId}'.` };
      hermanos.splice(Math.max(0, Math.min(op.index, hermanos.length)), 0, extraido);

      return {
        ok: true,
        tree: siguiente,
        audit: [
          {
            actorId: actor.userId,
            action: 'reordenar',
            nodeId: op.nodeId,
            detail: `Reordenado a la posicion ${op.index} dentro de su carpeta.`,
          },
        ],
      };
    }

    case 'enviar-a-papelera': {
      const encontrado = locate(siguiente.nodes, op.nodeId);
      if (!encontrado) return { ok: false, error: `El nodo '${op.nodeId}' no existe.` };

      const hermanos = encontrado.parent ? encontrado.parent.children : siguiente.nodes;
      const [extraido] = hermanos.splice(encontrado.index, 1);
      if (!extraido) return { ok: false, error: `No se pudo extraer el nodo '${op.nodeId}'.` };

      siguiente.trash.push({
        node: extraido,
        deletedAt: ahora,
        deletedBy: actor.userId,
        previousParentId: encontrado.parent?.id ?? null,
        previousIndex: encontrado.index,
      });

      return {
        ok: true,
        tree: siguiente,
        audit: [
          {
            actorId: actor.userId,
            action: 'enviar-a-papelera',
            nodeId: op.nodeId,
            detail: `${describir(extraido)} enviado a la papelera. No es un borrado: se puede restaurar.`,
          },
        ],
      };
    }

    case 'restaurar': {
      const indice = siguiente.trash.findIndex((t) => t.node.id === op.trashedNodeId);
      if (indice < 0) return { ok: false, error: `El nodo '${op.trashedNodeId}' no esta en la papelera.` };

      const entrada = siguiente.trash[indice];
      if (!entrada) return { ok: false, error: `El nodo '${op.trashedNodeId}' no esta en la papelera.` };

      // Se restaura a su carpeta original. Si esa carpeta ya no existe, NO se recuelga de la
      // raiz: hacerlo lo sacaria de una carpeta restrictiva y ampliaria su ambito en silencio.
      const destino = childrenOf(siguiente, entrada.previousParentId);
      if (!destino) {
        return {
          ok: false,
          error:
            `La carpeta original '${entrada.previousParentId}' ya no existe. Restaurar el nodo en ` +
            `la raiz cambiaria su ambito de acceso, asi que hay que elegir destino explicitamente.`,
        };
      }

      siguiente.trash.splice(indice, 1);
      destino.splice(Math.min(entrada.previousIndex, destino.length), 0, entrada.node);

      return {
        ok: true,
        tree: siguiente,
        audit: [
          {
            actorId: actor.userId,
            action: 'restaurar',
            nodeId: op.trashedNodeId,
            detail: `${describir(entrada.node)} restaurado a su carpeta original.`,
          },
        ],
      };
    }

    case 'borrar-definitivamente': {
      const indice = siguiente.trash.findIndex((t) => t.node.id === op.trashedNodeId);
      if (indice < 0) return { ok: false, error: `El nodo '${op.trashedNodeId}' no esta en la papelera.` };

      const entrada = siguiente.trash[indice];
      if (!entrada) return { ok: false, error: `El nodo '${op.trashedNodeId}' no esta en la papelera.` };
      siguiente.trash.splice(indice, 1);

      return {
        ok: true,
        tree: siguiente,
        audit: [
          {
            actorId: actor.userId,
            action: 'borrar-definitivamente',
            nodeId: op.trashedNodeId,
            detail: `${describir(entrada.node)} borrado definitivamente de la papelera.`,
          },
        ],
      };
    }

    default: {
      const exhaustivo: never = op;
      return { ok: false, error: `Operacion desconocida: ${JSON.stringify(exhaustivo)}` };
    }
  }
}

/** Advierte si la profundidad dificulta la navegacion (4.1.1). No bloquea: avisa. */
export function depthWarning(tree: ManagedTree, umbral = 4): string | null {
  const profundidad = (nodes: NavNode[]): number =>
    nodes.reduce((max, n) => Math.max(max, isFolder(n) ? 1 + profundidad(n.children) : 1), 0);
  const d = profundidad(tree.nodes);
  return d > umbral
    ? `El arbol tiene ${d} niveles de profundidad. Por encima de ${umbral} la navegacion se vuelve dificil de seguir.`
    : null;
}

/** Modulos actualmente en la papelera, para la vista de restauracion. */
export function trashedModules(tree: ManagedTree): TrashedNode[] {
  return tree.trash.filter((t) => isModule(t.node) || isFolder(t.node));
}
