import type { Aggregation, QueryResult } from '@app/data-contracts';
import type { GridPosition } from '@app/module-model';
import type {
  BindingProblem,
  IconName,
  ObjectInstance,
  FieldSlot,
} from '@app/ui-components';
import { objectRegistry } from './context';
import type { LoadedObject } from './data';

/** Forma que cruza del servidor al cliente. */
export interface SerializedObject {
  itemId: string;
  titulo: string;
  position: GridPosition;
  instance: ObjectInstance;
  result?: QueryResult;
  problems: BindingProblem[];
  /** Las ranuras que declara la version del objeto. */
  slots?: FieldSlot[];
  /** El icono que declara la VERSION del objeto. */
  icono?: IconName;
  /** Con que operador se resume cada medida, alineado con `instance.binding.measures`. */
  aggregations: Aggregation[];
  unresolvedObject?: string;
  generatedAt?: string;
  stale?: boolean;
  /** El contenido de un contenedor, ya serializado. */
  panels?: SerializedPanel[];
}

export interface SerializedPanel {
  panelId: string;
  nombre: string;
  objetos: SerializedObject[];
}

export function objectSerialize(objeto: LoadedObject): SerializedObject {
  const { item } = objeto;
  return {
    itemId: item.id,
    titulo: item.instance.title ?? item.instance.objectId,
    position: item.position,
    instance: item.instance,
    ...(objeto.result ? { result: objeto.result } : {}),
    ...(objectSlots(item.instance) ? { slots: objectSlots(item.instance) } : {}),
    ...(objectIcon(item.instance) ? { icono: objectIcon(item.instance) } : {}),
    problems: objeto.problems,
    aggregations: objeto.aggregations,
    ...(objeto.unresolvedObject ? { unresolvedObject: objeto.unresolvedObject } : {}),
    ...(objeto.generatedAt ? { generatedAt: objeto.generatedAt } : {}),
    ...(objeto.stale ? { stale: true } : {}),
    ...(objeto.panels
      ? {
          panels: objeto.panels.map((panel) => ({
            panelId: panel.panelId,
            nombre: panel.nombre,
            objetos: panel.objetos.map(objectSerialize),
          })),
        }
      : {}),
  };
}

/** Las ranuras declaradas por la version que la instancia fija. */
function objectSlots(instance: ObjectInstance): FieldSlot[] | undefined {
  try {
    return objectRegistry.resolve(instance.objectId, instance.version).dataContract.wells;
  } catch {
    return undefined;
  }
}

/** El icono que declara el objeto. `undefined` si no se resuelve: el objeto roto no lo necesita. */
function objectIcon(instance: ObjectInstance): IconName | undefined {
  try {
    return objectRegistry.get(instance.objectId)?.icono;
  } catch {
    return undefined;
  }
}
