import type { Aggregation, QueryResult } from '@app/data-contracts';
import type { GridPosition } from '@app/module-model';
import type {
  BindingProblem,
  NombreDeIcono,
  ObjectInstance,
  RanuraDeCampos,
} from '@app/ui-components';
import { objectRegistry } from './contexto';
import type { ObjetoCargado } from './datos';

/** Forma que cruza del servidor al cliente. */
export interface ObjetoSerializado {
  itemId: string;
  titulo: string;
  position: GridPosition;
  instance: ObjectInstance;
  result?: QueryResult;
  problems: BindingProblem[];
  /** Las ranuras que declara la version del objeto. */
  ranuras?: RanuraDeCampos[];
  /** El icono que declara la VERSION del objeto. */
  icono?: NombreDeIcono;
  /** Con que operador se resume cada medida, alineado con `instance.binding.measures`. */
  aggregations: Aggregation[];
  unresolvedObject?: string;
  generatedAt?: string;
  stale?: boolean;
  /** El contenido de un contenedor, ya serializado. */
  paneles?: PanelSerializado[];
}

export interface PanelSerializado {
  panelId: string;
  nombre: string;
  objetos: ObjetoSerializado[];
}

export function serializarObjeto(objeto: ObjetoCargado): ObjetoSerializado {
  const { item } = objeto;
  return {
    itemId: item.id,
    titulo: item.instance.title ?? item.instance.objectId,
    position: item.position,
    instance: item.instance,
    ...(objeto.result ? { result: objeto.result } : {}),
    ...(ranurasDelObjeto(item.instance) ? { ranuras: ranurasDelObjeto(item.instance) } : {}),
    ...(iconoDelObjeto(item.instance) ? { icono: iconoDelObjeto(item.instance) } : {}),
    problems: objeto.problems,
    aggregations: objeto.aggregations,
    ...(objeto.unresolvedObject ? { unresolvedObject: objeto.unresolvedObject } : {}),
    ...(objeto.generatedAt ? { generatedAt: objeto.generatedAt } : {}),
    ...(objeto.stale ? { stale: true } : {}),
    ...(objeto.paneles
      ? {
          paneles: objeto.paneles.map((panel) => ({
            panelId: panel.panelId,
            nombre: panel.nombre,
            objetos: panel.objetos.map(serializarObjeto),
          })),
        }
      : {}),
  };
}

/** Las ranuras declaradas por la version que la instancia fija. */
function ranurasDelObjeto(instance: ObjectInstance): RanuraDeCampos[] | undefined {
  try {
    return objectRegistry.resolve(instance.objectId, instance.version).dataContract.pozos;
  } catch {
    return undefined;
  }
}

/** El icono que declara el objeto. `undefined` si no se resuelve: el objeto roto no lo necesita. */
function iconoDelObjeto(instance: ObjectInstance): NombreDeIcono | undefined {
  try {
    return objectRegistry.get(instance.objectId)?.icono;
  } catch {
    return undefined;
  }
}
