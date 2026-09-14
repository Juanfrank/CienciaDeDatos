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
/*
 * Lo que toda fila necesita para poder moverse.
 *
 * El indice y el numero de hermanos vienen del servidor porque `reordenar` toma un indice
 * ABSOLUTO y el cliente no conoce el arbol. Con ellos, el boton de subir del primero y el de
 * bajar del ultimo salen apagados en vez de fallar al pulsarlos.
 */
interface FilaComun {
  profundidad: number;
  indice: number;
  hermanos: number;
  /** Oculta: sigue en el arbol y no se le dibuja a nadie. */
  hidden: boolean;
  /*
   * La carpeta que la contiene, o null en la raiz.
   *
   * Sin esto, una lista plana no sabe que se lleva consigo al plegar una carpeta: la profundidad
   * sola diria «lo que viene detras con mas profundidad», que se rompe en cuanto hay dos ramas
   * seguidas al mismo nivel.
   */
  padre: string | null;
}

export interface FilaCarpeta extends FilaComun {
  tipo: 'carpeta';
  id: string;
  nombre: string;
  /** Ambito propio, si lo tiene. Lo que no lo tiene hereda y no restringe por su cuenta. */
  scope?: AccessScope;
  /** Cuantos modulos cuelgan de ella, contando los de sus subcarpetas. */
  modulos: number;
}

export interface FilaModulo extends FilaComun {
  tipo: 'modulo';
  id: string;
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
  padre: string | null = null,
): FilaOrganizacion[] {
  const filas: FilaOrganizacion[] = [];

  /*
   * En el ORDEN DEL ARBOL, sin ordenar por nombre.
   *
   * Antes salian las carpetas primero y cada grupo alfabetico, que se lee bien mientras la tabla
   * solo se mire. En cuanto cada fila lleva flechas de subir y bajar, ordenar la vista es mentir:
   * las flechas mueven el orden REAL, asi que pulsar «bajar» en la fila que parece primera la
   * movia en una secuencia que no estaba en pantalla — y a veces la tabla no cambiaba nada, que
   * es exactamente como se ve un boton roto.
   *
   * El orden del arbol es ademas el que ve la gente en el menu, asi que la tabla y la navegacion
   * ensenan por fin lo mismo.
   */
  nodos.forEach((nodo, indice) => {
    if (isFolder(nodo)) {
      filas.push({
        tipo: 'carpeta',
        id: nodo.id,
        nombre: nodo.name,
        profundidad,
        indice,
        hermanos: nodos.length,
        hidden: nodo.hidden === true,
        padre,
        ...(nodo.scope ? { scope: nodo.scope } : {}),
        modulos: modulosBajo(nodo.children),
      });
      filas.push(...organizationRows(nodo.children, definiciones, profundidad + 1, nodo.id));
      return;
    }

    // Una referencia a un modulo que ya no existe se omite en vez de dibujarse a medias: es un
    // nodo colgante, y eso lo denuncia el editor del arbol, que es donde se arregla.
    const definicion = definiciones.get(nodo.moduleRef.moduleId);
    if (!definicion) return;

    filas.push({
      tipo: 'modulo',
      id: nodo.id,
      profundidad,
      indice,
      hermanos: nodos.length,
      hidden: nodo.hidden === true,
      padre,
      modulo: definicion,
    });
  });

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
