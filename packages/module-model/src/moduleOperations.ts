import type { GridItem, ModulePage } from './ModuleDefinition';
import type { GridPosition } from './grid';

/**
 * Una operacion por cambio, en vez de reescribir la definicion entera — apartado 2.3.
 *
 * El editor mandaba las paginas completas cada vez que alguien marcaba una casilla. Funcionaba, y
 * tenia dos problemas que no se ven con un modulo pequeno y una sola persona:
 *
 * 1. Dos personas sobre el mismo borrador se pisan. Cada envio dice «el modulo es EXACTAMENTE
 *    esto», asi que el segundo en llegar borra lo que hizo el primero aunque tocaran cosas
 *    distintas. Con operaciones, «anadir un objeto en la pagina dos» y «renombrar la pagina uno»
 *    se componen, porque cada una dice lo que cambia y no lo que queda.
 * 2. El coste crece con el modulo y no con el cambio. Mover una caja en un modulo de doce paginas
 *    mandaba las doce.
 *
 * Es la misma forma que `applyTreeOperation` en el arbol, y por el mismo motivo: la funcion es
 * PURA y vive en el modelo, de modo que el servidor y el editor aplican exactamente lo mismo.
 * Dos implementaciones —una para dibujar y otra para guardar— acaban difiriendo, y la diferencia
 * aparece como «lo que veia no es lo que se guardo».
 */

export type ModuleOperation =
  /** Una pagina nueva, al final. */
  | { kind: 'page-add'; page: ModulePage }
  /** El rotulo de una pagina. El slug NO se toca: hay saltos y marcadores que lo apuntan. */
  | { kind: 'page-rename'; pageSlug: string; name: string }
  | { kind: 'page-remove'; pageSlug: string }
  | { kind: 'item-add'; pageSlug: string; item: GridItem }
  | { kind: 'item-remove'; pageSlug: string; itemId: string }
  /** Reemplaza un objeto entero: mapear un campo, cambiar su presentacion, adjuntar algo. */
  | { kind: 'item-replace'; pageSlug: string; item: GridItem }
  /** Solo la posicion. Es la mas frecuente de todas —cada arrastre— y la mas barata. */
  | { kind: 'item-move'; pageSlug: string; itemId: string; position: GridPosition };

export type ModuleOperationResult =
  | { ok: true; pages: ModulePage[] }
  | { ok: false; error: string };

/** Todos los identificadores de objeto del modulo, que tienen que ser unicos entre paginas. */
const idsDe = (pages: ModulePage[]): Set<string> =>
  new Set(pages.flatMap((p) => p.items.map((i) => i.id)));

/**
 * Aplica UNA operacion sobre las paginas, o explica por que no.
 *
 * Devuelve paginas nuevas y no muta las que recibe: quien la llama suele tener las anteriores
 * dibujadas en pantalla, y mutarlas haria que React no viera el cambio.
 */
export function applyModuleOperation(
  pages: ModulePage[],
  op: ModuleOperation,
): ModuleOperationResult {
  if (op.kind === 'page-add') {
    if (pages.some((p) => p.slug === op.page.slug)) {
      return { ok: false, error: `Ya hay una pagina con el slug '${op.page.slug}'.` };
    }
    /*
     * Un identificador repetido no es un detalle: el objeto es el mismo para la rejilla, para el
     * panel y para los complementos, asi que editar uno editaria los dos y quitar uno los
     * borraria a los dos.
     */
    const existentes = idsDe(pages);
    const repetido = op.page.items.find((i) => existentes.has(i.id));
    if (repetido) {
      return { ok: false, error: `El objeto '${repetido.id}' ya existe en este modulo.` };
    }
    return { ok: true, pages: [...pages, op.page] };
  }

  const indice = pages.findIndex((p) => p.slug === op.pageSlug);
  const pagina = pages[indice];
  if (!pagina) return { ok: false, error: `La pagina '${op.pageSlug}' no existe.` };

  const conPagina = (siguiente: ModulePage): ModuleOperationResult => ({
    ok: true,
    pages: pages.map((p, i) => (i === indice ? siguiente : p)),
  });

  switch (op.kind) {
    case 'page-rename':
      return conPagina({ ...pagina, name: op.name });

    case 'page-remove':
      /*
       * La ultima no se quita. Un modulo sin ninguna pagina no se puede dibujar, y el editor se
       * quedaria sin lienzo donde volver a empezar.
       */
      if (pages.length < 2) {
        return { ok: false, error: 'No se puede quitar la unica pagina del modulo.' };
      }
      return { ok: true, pages: pages.filter((_, i) => i !== indice) };

    case 'item-add': {
      if (idsDe(pages).has(op.item.id)) {
        return { ok: false, error: `El objeto '${op.item.id}' ya existe en este modulo.` };
      }
      return conPagina({ ...pagina, items: [...pagina.items, op.item] });
    }

    case 'item-remove': {
      if (!pagina.items.some((i) => i.id === op.itemId)) {
        return { ok: false, error: `El objeto '${op.itemId}' no esta en '${op.pageSlug}'.` };
      }
      return conPagina({ ...pagina, items: pagina.items.filter((i) => i.id !== op.itemId) });
    }

    case 'item-replace': {
      if (!pagina.items.some((i) => i.id === op.item.id)) {
        return { ok: false, error: `El objeto '${op.item.id}' no esta en '${op.pageSlug}'.` };
      }
      return conPagina({
        ...pagina,
        items: pagina.items.map((i) => (i.id === op.item.id ? op.item : i)),
      });
    }

    case 'item-move': {
      if (!pagina.items.some((i) => i.id === op.itemId)) {
        return { ok: false, error: `El objeto '${op.itemId}' no esta en '${op.pageSlug}'.` };
      }
      return conPagina({
        ...pagina,
        items: pagina.items.map((i) =>
          i.id === op.itemId ? { ...i, position: op.position } : i,
        ),
      });
    }
  }
}

/**
 * Aplica una tanda en orden, y se para en la primera que no se puede.
 *
 * Todo o nada: una tanda a medias deja el borrador en un estado que nadie pidio y que quien
 * editaba no puede describir. El error dice CUAL fallo, porque «no se pudo guardar» sobre una
 * tanda de seis no dice donde mirar.
 */
export function applyModuleOperations(
  pages: ModulePage[],
  ops: ModuleOperation[],
): ModuleOperationResult {
  let acumuladas = pages;
  for (const [i, op] of ops.entries()) {
    const resultado = applyModuleOperation(acumuladas, op);
    if (!resultado.ok) {
      return { ok: false, error: `Operacion ${i + 1} (${op.kind}): ${resultado.error}` };
    }
    acumuladas = resultado.pages;
  }
  return { ok: true, pages: acumuladas };
}
