import {
  type GridPosition,
  type ModuleDefinition,
  type UserPersonalization,
  assertPersonalizationIsPresentationOnly,
  validateLayout,
} from '@app/module-model';
import { borrar, write, leer } from './almacenCompartido';

/** Personalizacion por usuario final — seccion 4.6. */

const clave = (userId: string, moduleId: string): string =>
  `app:personalizacion:${userId}:${moduleId}`;

export async function readPersonalization(
  userId: string,
  moduleId: string,
): Promise<UserPersonalization | undefined> {
  return leer<UserPersonalization>(clave(userId, moduleId));
}

export class PersonalizationInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonalizationInvalidError';
  }
}

export interface SavePersonalizationInput {
  userId: string;
  module: ModuleDefinition;
  /** Ausente = se conserva lo que ya hubiera guardado. */
  hiddenItemIds?: string[];
  positionOverrides?: Record<string, GridPosition>;
  columnOrder?: Record<string, string[]>;
  /** El cuerpo crudo de la peticion, para comprobar que no trae campos prohibidos. */
  crudo?: Record<string, unknown>;
}

/**
 * Guarda la personalizacion, cambiando SOLO lo que se envia.
 *
 * Lo que no viene se conserva. Antes se reescribia el registro entero, y eso convertia dos gestos
 * independientes en uno destructivo: colocar los objetos habria borrado los que estuvieran
 * ocultos, porque la pantalla que coloca no sabe cuales son —ya no los ve—.
 */
export async function savePersonalization(
  input: SavePersonalizationInput,
): Promise<UserPersonalization> {
  if (input.crudo) assertPersonalizationIsPresentationOnly(input.crudo);

  const previa = await readPersonalization(input.userId, input.module.moduleId);
  const ocultos = input.hiddenItemIds ?? previa?.hiddenItemIds ?? [];
  const posiciones = input.positionOverrides ?? previa?.positionOverrides ?? {};

  // Solo se aceptan ids de objetos que el modulo TIENE. Guardar ids inventados no hace daño por
  // si mismo —al aplicarlos no ocultarian nada— pero convertiria la personalizacion en un sitio
  // donde escribir texto arbitrario asociado a una persona, y ademas dejaria basura cuando el
  // modulo cambie.
  const existentes = new Set(input.module.pages.flatMap((p) => p.items.map((i) => i.id)));
  const desconocidos = [...ocultos, ...Object.keys(posiciones)].filter(
    (id) => !existentes.has(id),
  );
  if (desconocidos.length > 0) {
    throw new PersonalizationInvalidError(
      `Estos objetos no existen en el modulo: ${[...new Set(desconocidos)].join(', ')}.`,
    );
  }

  // Ocultarlo TODO deja una pagina en blanco que parece una averia. Se rechaza con un mensaje
  // que dice que hacer, en vez de guardar un estado del que cuesta salir.
  if (existentes.size > 0 && ocultos.length >= existentes.size) {
    throw new PersonalizationInvalidError(
      'No se pueden ocultar todos los objetos: la vista quedaria vacia. Si no quiere ver este ' +
        'modulo, deje de abrirlo; para volver a la vista oficial, descarte su personalizacion.',
    );
  }

  /*
   * La disposicion RESULTANTE tiene que ser valida, no solo cada posicion por separado.
   *
   * Mover un objeto encima de otro produce dos posiciones validas una a una y una vista rota, y
   * quien la guardara tendria que descartar su personalizacion entera para poder salir.
   *
   * Pero se rechaza solo lo que la personalizacion ROMPE, no lo que ya estaba roto: se comparan
   * los problemas de la disposicion institucional con los de la resultante y solo los nuevos
   * cuentan. Un modulo que ya se publico con dos objetos pisandose es un problema de quien lo
   * publico; impedir por eso que alguien coloque su propia vista seria castigar a quien no lo
   * causo, y ademas le quitaria justamente la herramienta con la que podria apartarlos.
   */
  const firma = (p: { kind: string; itemIds: string[] }) =>
    `${p.kind}:${[...p.itemIds].sort().join(',')}`;

  for (const page of input.module.pages) {
    const visibles = page.items.filter((i) => !ocultos.includes(i.id));
    const antes = new Set(
      validateLayout(visibles.map((i) => ({ id: i.id, position: i.position }))).map(firma),
    );
    const nuevos = validateLayout(
      visibles.map((i) => ({ id: i.id, position: posiciones[i.id] ?? i.position })),
    ).filter((p) => !antes.has(firma(p)));

    if (nuevos.length > 0) {
      throw new PersonalizationInvalidError(nuevos.map((p) => p.problem).join(' '));
    }
  }

  const personalizacion: UserPersonalization = {
    userId: input.userId,
    moduleId: input.module.moduleId,
    hiddenItemIds: [...new Set(ocultos)],
    positionOverrides: posiciones,
    ...(input.columnOrder ?? previa?.columnOrder
      ? { columnOrder: input.columnOrder ?? previa?.columnOrder ?? {} }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  await write(clave(input.userId, input.module.moduleId), personalizacion);
  return personalizacion;
}

/** Descarta la personalizacion y devuelve a la vista institucional. */
export async function personalizationDiscard(userId: string, moduleId: string): Promise<void> {
  await borrar(clave(userId, moduleId));
}
