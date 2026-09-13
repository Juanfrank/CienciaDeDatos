import {
  type ModuleDefinition,
  type UserPersonalization,
  assertPersonalizationIsPresentationOnly,
} from '@app/module-model';
import { borrar, escribir, leer } from './almacenCompartido';

/** Personalizacion por usuario final — seccion 4.6. */

const clave = (userId: string, moduleId: string): string =>
  `app:personalizacion:${userId}:${moduleId}`;

export async function leerPersonalizacion(
  userId: string,
  moduleId: string,
): Promise<UserPersonalization | undefined> {
  return leer<UserPersonalization>(clave(userId, moduleId));
}

export class PersonalizacionInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonalizacionInvalidaError';
  }
}

export interface GuardarPersonalizacionInput {
  userId: string;
  module: ModuleDefinition;
  hiddenItemIds: string[];
  positionOverrides?: Record<string, import('@app/module-model').GridPosition>;
  columnOrder?: Record<string, string[]>;
  /** El cuerpo crudo de la peticion, para comprobar que no trae campos prohibidos. */
  crudo?: Record<string, unknown>;
}

export async function guardarPersonalizacion(
  input: GuardarPersonalizacionInput,
): Promise<UserPersonalization> {
  if (input.crudo) assertPersonalizationIsPresentationOnly(input.crudo);

  // Solo se aceptan ids de objetos que el modulo TIENE. Guardar ids inventados no hace daño por
  // si mismo —al aplicarlos no ocultarian nada— pero convertiria la personalizacion en un sitio
  // donde escribir texto arbitrario asociado a una persona, y ademas dejaria basura cuando el
  // modulo cambie.
  const existentes = new Set(input.module.pages.flatMap((p) => p.items.map((i) => i.id)));
  const desconocidos = input.hiddenItemIds.filter((id) => !existentes.has(id));
  if (desconocidos.length > 0) {
    throw new PersonalizacionInvalidaError(
      `Estos objetos no existen en el modulo: ${desconocidos.join(', ')}.`,
    );
  }

  // Ocultarlo TODO deja una pagina en blanco que parece una averia. Se rechaza con un mensaje
  // que dice que hacer, en vez de guardar un estado del que cuesta salir.
  if (existentes.size > 0 && input.hiddenItemIds.length >= existentes.size) {
    throw new PersonalizacionInvalidaError(
      'No se pueden ocultar todos los objetos: la vista quedaria vacia. Si no quiere ver este ' +
        'modulo, deje de abrirlo; para volver a la vista oficial, descarte su personalizacion.',
    );
  }

  const personalizacion: UserPersonalization = {
    userId: input.userId,
    moduleId: input.module.moduleId,
    hiddenItemIds: [...new Set(input.hiddenItemIds)],
    positionOverrides: input.positionOverrides ?? {},
    ...(input.columnOrder ? { columnOrder: input.columnOrder } : {}),
    updatedAt: new Date().toISOString(),
  };

  await escribir(clave(input.userId, input.module.moduleId), personalizacion);
  return personalizacion;
}

/** Descarta la personalizacion y devuelve a la vista institucional. */
export async function descartarPersonalizacion(userId: string, moduleId: string): Promise<void> {
  await borrar(clave(userId, moduleId));
}
