import type { GridItem, ModuleDefinition, ModulePage } from './ModuleDefinition';

/**
 * Que cambia entre dos versiones de un modulo.
 *
 * Es lo que le falta a quien aprueba. Hoy la decision se toma mirando el modulo entero y
 * acordandose de como estaba: eso funciona la primera semana y deja de funcionar en cuanto hay
 * doce modulos y tres personas proponiendo. Aprobar sin ver que cambia es firmar en blanco.
 *
 * Se compara por IDENTIDAD —`pageId`, `id` del elemento—, no por posicion en el array. Comparar
 * por posicion convierte «se movio el segundo objeto al primer sitio» en «cambiaron los dos»,
 * que es ruido y hace que el resumen deje de leerse.
 */

export interface ObjectChange {
  id: string;
  /** El titulo que se lee en pantalla, para poder nombrarlo sin ensenar el identificador. */
  title: string;
  pageName: string;
}

export interface ModuleDiff {
  /** Paginas que antes no estaban, por su nombre. */
  addedPages: string[];
  removedPages: string[];
  addedObjects: ObjectChange[];
  removedObjects: ObjectChange[];
  /** Los que siguen estando y NO son iguales: cambio el mapeo, el formato o el sitio. */
  changedObjects: ObjectChange[];
  /** El nombre del modulo, si cambio. */
  renamed?: { from: string; to: string };
  /** Si no cambia nada, quien aprueba deberia saberlo antes de mirar. */
  identical: boolean;
}

const itemsOf = (pages: ModulePage[]): Map<string, { item: GridItem; page: ModulePage }> =>
  new Map(pages.flatMap((page) => page.items.map((item) => [item.id, { item, page }])));

/**
 * Igualdad por contenido serializado.
 *
 * Es deliberadamente grosero: cualquier diferencia cuenta como cambio. Un resumen que intentara
 * decir QUE propiedad cambio tendria que conocer la forma de cada objeto del catalogo, y se
 * quedaria desactualizado en cuanto entrara uno nuevo. Decir «este objeto cambio» siempre es
 * cierto, y el enlace al modulo ensena el que.
 */
const igual = (a: GridItem, b: GridItem): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function diffModules(
  antes: Pick<ModuleDefinition, 'name' | 'pages'>,
  despues: Pick<ModuleDefinition, 'name' | 'pages'>,
): ModuleDiff {
  const paginasAntes = new Map(antes.pages.map((p) => [p.pageId, p]));
  const paginasDespues = new Map(despues.pages.map((p) => [p.pageId, p]));

  const addedPages = despues.pages.filter((p) => !paginasAntes.has(p.pageId)).map((p) => p.name);
  const removedPages = antes.pages.filter((p) => !paginasDespues.has(p.pageId)).map((p) => p.name);

  const objetosAntes = itemsOf(antes.pages);
  const objetosDespues = itemsOf(despues.pages);

  const describir = (id: string, de: typeof objetosDespues): ObjectChange => {
    const encontrado = de.get(id);
    return {
      id,
      title: encontrado?.item.instance.title ?? id,
      pageName: encontrado?.page.name ?? '',
    };
  };

  const addedObjects = [...objetosDespues.keys()]
    .filter((id) => !objetosAntes.has(id))
    .map((id) => describir(id, objetosDespues));
  const removedObjects = [...objetosAntes.keys()]
    .filter((id) => !objetosDespues.has(id))
    .map((id) => describir(id, objetosAntes));
  const changedObjects = [...objetosDespues.keys()]
    .filter((id) => {
      const viejo = objetosAntes.get(id);
      const nuevo = objetosDespues.get(id);
      return viejo !== undefined && nuevo !== undefined && !igual(viejo.item, nuevo.item);
    })
    .map((id) => describir(id, objetosDespues));

  const renamed = antes.name === despues.name ? undefined : { from: antes.name, to: despues.name };

  return {
    addedPages,
    removedPages,
    addedObjects,
    removedObjects,
    changedObjects,
    ...(renamed === undefined ? {} : { renamed }),
    identical:
      addedPages.length === 0 &&
      removedPages.length === 0 &&
      addedObjects.length === 0 &&
      removedObjects.length === 0 &&
      changedObjects.length === 0 &&
      renamed === undefined,
  };
}
