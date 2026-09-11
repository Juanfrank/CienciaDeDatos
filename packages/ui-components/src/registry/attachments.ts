import type { BindingProblem } from './viewModel';
import type {
  AttachedObjectInstance,
  ObjectInstance,
  VisualObjectDefinition,
} from './types';

/**
 * Validacion de objetos adjuntados.
 *
 * Un complemento no es un objeto independiente: no ocupa una celda de la rejilla y no se enlaza
 * contra un dataset propio, sino que lee el de su anfitrion. Eso deja dos errores simetricos que
 * hay que rechazar por igual — colocar un complemento como objeto suelto, y adjuntar un objeto
 * que no es complemento — y ambos son de configuracion, asi que tienen que detectarse al GUARDAR
 * el modulo y no al dibujarlo. Es el mismo criterio de 4.2 que ya rige el mapeo de campos.
 *
 * Devuelve problemas en vez de lanzar, por la misma razon que `validateBinding`: el editor tiene
 * que poder dibujar lo que hay y senalarlo, no quedarse en blanco.
 */

export type BuscarDefinicion = (objectId: string) => VisualObjectDefinition | undefined;

/** Un complemento de tabla con alcance de subobjeto necesita una dimension por la que desglosar. */
function exigeDimension(adjunto: AttachedObjectInstance): boolean {
  return adjunto.objectId === 'tabla-de-datos' && adjunto.scope === 'subobjeto';
}

export function validateAttachments(
  instance: ObjectInstance,
  buscar: BuscarDefinicion,
): BindingProblem[] {
  const problemas: BindingProblem[] = [];

  const anfitrion = buscar(instance.objectId);
  if (anfitrion?.attachable) {
    problemas.push({
      slot: instance.objectId,
      kind: 'contrato-incumplido',
      problem:
        `'${anfitrion.name}' es un complemento: se adjunta a otro objeto y no puede colocarse ` +
        'como objeto independiente en la rejilla.',
    });
  }

  const vistos = new Set<string>();

  for (const adjunto of instance.attachments ?? []) {
    const definicion = buscar(adjunto.objectId);

    if (!definicion) {
      problemas.push({
        slot: adjunto.objectId,
        kind: 'campo-inexistente',
        problem: `El complemento '${adjunto.objectId}' no existe en el repositorio de objetos.`,
      });
      continue;
    }

    if (!definicion.attachable) {
      problemas.push({
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
      problemas.push({
        slot: adjunto.objectId,
        kind: 'contrato-incumplido',
        problem: `El objeto ya tiene adjunto un '${definicion.name}'. Solo se admite uno de cada tipo.`,
      });
    }
    vistos.add(adjunto.objectId);

    if (exigeDimension(adjunto) && instance.binding.dimensions.length === 0) {
      problemas.push({
        slot: adjunto.objectId,
        kind: 'contrato-incumplido',
        problem:
          'El alcance de subobjeto desglosa por una categoria, y este objeto no mapea ninguna ' +
          'dimension: no hay subobjeto por el que desglosar. Use el alcance de objeto.',
      });
    }
  }

  return problemas;
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
