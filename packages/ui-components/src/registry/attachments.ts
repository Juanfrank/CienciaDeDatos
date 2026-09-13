import type { BindingProblem } from './viewModel';
import type {
  AttachedObjectInstance,
  ObjectInstance,
  VisualObjectDefinition,
} from './types';

/** Validacion de objetos adjuntados. */

export type BuscarDefinicion = (objectId: string) => VisualObjectDefinition | undefined;

/** Un complemento de tabla con alcance de subobjeto necesita una dimension por la que desglosar. */
function exigeDimension(adjunto: AttachedObjectInstance): boolean {
  return adjunto.objectId === 'tabla-de-datos' && adjunto.scope === 'subobjeto';
}

export function validateAttachments(
  instance: ObjectInstance,
  search: BuscarDefinicion,
): BindingProblem[] {
  const problems: BindingProblem[] = [];

  const anfitrion = search(instance.objectId);
  if (anfitrion?.attachable) {
    problems.push({
      slot: instance.objectId,
      kind: 'contrato-incumplido',
      problem:
        `'${anfitrion.name}' es un complemento: se adjunta a otro objeto y no puede colocarse ` +
        'como objeto independiente en la rejilla.',
    });
  }

  const vistos = new Set<string>();

  for (const adjunto of instance.attachments ?? []) {
    const definicion = search(adjunto.objectId);

    if (!definicion) {
      problems.push({
        slot: adjunto.objectId,
        kind: 'campo-inexistente',
        problem: `El complemento '${adjunto.objectId}' no existe en el repositorio de objetos.`,
      });
      continue;
    }

    if (!definicion.attachable) {
      problems.push({
        slot: adjunto.objectId,
        kind: 'contrato-incumplido',
        problem:
          `'${definicion.name}' no es un complemento: es un objeto independiente y no puede ` +
          'adjuntarse a otro.',
      });
    }

    // Dos tooltips explicativos en el mismo objeto no significan nada, y dos tablas de datos
    // dejarian al anfitrion con dos iconos que abren lo mismo.
    if (vistos.has(adjunto.objectId)) {
      problems.push({
        slot: adjunto.objectId,
        kind: 'contrato-incumplido',
        problem: `El objeto ya tiene adjunto un '${definicion.name}'. Solo se admite uno de cada tipo.`,
      });
    }
    vistos.add(adjunto.objectId);

    if (exigeDimension(adjunto) && instance.binding.dimensions.length === 0) {
      problems.push({
        slot: adjunto.objectId,
        kind: 'contrato-incumplido',
        problem:
          'El alcance de subobjeto desglosa por una categoria, y este objeto no mapea ninguna ' +
          'dimension: no hay subobjeto por el que desglosar. Use el alcance de objeto.',
      });
    }
  }

  return problems;
}

/** El complemento de un tipo dado, si el objeto lo tiene adjunto. */
export function attachmentOf<T extends AttachedObjectInstance['objectId']>(
  instance: ObjectInstance,
  objectId: T,
): Extract<AttachedObjectInstance, { objectId: T }> | undefined {
  return (instance.attachments ?? []).find((a) => a.objectId === objectId) as
    | Extract<AttachedObjectInstance, { objectId: T }>
    | undefined;
}
