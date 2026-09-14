import { isFolder, isModule, type AccessScope, type NavNode } from '@app/access-control';
import type { ModuleDefinition } from '@app/module-model';

/**
 * La organizacion general aplanada en filas, conservando la jerarquia — secciones 4.1 y 4.10.6.
 *
 * La lista de modulos estaba ordenada por nombre, y eso borra lo unico que explica el acceso: un
 * modulo hereda el ambito de la carpeta que lo contiene, asi que dos modulos contiguos en una
 * lista alfabetica pueden verlos audiencias distintas sin que nada en pantalla lo diga. Lo que
 * hay que ver es el arbol.
 *
 * Se aplana a filas en vez de devolver el arbol anidado porque el destino es una TABLA: las
 * columnas —estado, version, objetos— tienen que alinearse entre filas, y una tabla por nivel no
 * alinea nada. La profundidad viaja en cada fila y la sangria la pone el estilo.
 */
export interface FilaCarpeta {
  tipo: 'carpeta';
  id: string;
  nombre: string;
  profundidad: number;
  /** Ambito propio, si lo tiene. Lo que no lo tiene hereda y no restringe por su cuenta. */
  scope?: AccessScope;
  /** Cuantos modulos cuelgan de ella, contando los de sus subcarpetas. */
  modulos: number;
}

export interface FilaModulo {
  tipo: 'modulo';
  id: string;
  profundidad: number;
  modulo: ModuleDefinition;
}

export type FilaOrganizacion = FilaCarpeta | FilaModulo;

/** Cuantos modulos cuelgan de un nodo, en cualquier nivel. */
function modulosBajo(nodos: NavNode[]): number {
  return nodos.reduce(
    (n, nodo) => n + (isModule(nodo) ? 1 : modulosBajo((nodo as { children: NavNode[] }).children)),
    0,
  );
}

/**
 * Las filas del arbol, en el orden en que se dibujan.
 *
 * `definiciones` es lo que el almacen de modulos sabe de cada uno —estado, version, paginas—, que
 * el arbol no guarda: el arbol solo tiene una referencia. Un modulo referenciado y que ya no
 * existe se omite en vez de dibujarse a medias; queda como nodo colgante y eso lo denuncia el
 * editor del arbol, que es donde se arregla.
 */
export function organizationRows(
  nodos: NavNode[],
  definiciones: Map<string, ModuleDefinition>,
  profundidad = 0,
): FilaOrganizacion[] {
  const filas: FilaOrganizacion[] = [];

  // Carpetas primero y modulos despues, cada grupo por nombre: es como se lee un arbol de
  // archivos en cualquier sitio, y evita que una carpeta quede escondida entre veinte modulos.
  const carpetas = nodos.filter(isFolder).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const modulos = nodos
    .filter(isModule)
    .map((nodo) => ({ nodo, definicion: definiciones.get(nodo.moduleRef.moduleId) }))
    .filter((p): p is { nodo: (typeof p)['nodo']; definicion: ModuleDefinition } =>
      p.definicion !== undefined,
    )
    .sort((a, b) => a.definicion.name.localeCompare(b.definicion.name, 'es'));

  for (const carpeta of carpetas) {
    filas.push({
      tipo: 'carpeta',
      id: carpeta.id,
      nombre: carpeta.name,
      profundidad,
      ...(carpeta.scope ? { scope: carpeta.scope } : {}),
      modulos: modulosBajo(carpeta.children),
    });
    filas.push(...organizationRows(carpeta.children, definiciones, profundidad + 1));
  }

  for (const { nodo, definicion } of modulos) {
    filas.push({ tipo: 'modulo', id: nodo.id, profundidad, modulo: definicion });
  }

  return filas;
}

/**
 * Los modulos que el arbol no coloca en ninguna parte.
 *
 * Un borrador recien creado todavia no esta en la organizacion general —ahi entra al publicarse—,
 * y sin esto desapareceria de la pantalla al pasar de lista plana a arbol. Perder de vista lo que
 * no esta colocado seria peor que la lista plana que habia antes.
 */
export function looseModules(
  nodos: NavNode[],
  definiciones: Map<string, ModuleDefinition>,
): ModuleDefinition[] {
  const colocados = new Set<string>();
  const recorrer = (cuales: NavNode[]) => {
    for (const nodo of cuales) {
      if (isModule(nodo)) colocados.add(nodo.moduleRef.moduleId);
      else recorrer(nodo.children);
    }
  };
  recorrer(nodos);

  return [...definiciones.values()]
    .filter((m) => !colocados.has(m.moduleId))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
