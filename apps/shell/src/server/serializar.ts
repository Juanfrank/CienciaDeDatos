import type { Agregacion, QueryResult } from '@app/data-contracts';
import type { GridPosition } from '@app/module-model';
import type {
  BindingProblem,
  NombreDeIcono,
  ObjectInstance,
  RanuraDeCampos,
} from '@app/ui-components';
import { objectRegistry } from './contexto';
import type { ObjetoCargado } from './datos';

/**
 * Forma que cruza del servidor al cliente.
 *
 * Solo viaja lo ya filtrado: el navegador nunca recibe filas que el ambito de quien mira no
 * permita. Tampoco viaja el ambito en si — no hace falta en el cliente, y enviarlo daria pistas
 * sobre lo que existe fuera del alcance de esa persona (4.11).
 */
export interface ObjetoSerializado {
  itemId: string;
  titulo: string;
  position: GridPosition;
  instance: ObjectInstance;
  result?: QueryResult;
  problems: BindingProblem[];
  /**
   * Las ranuras que declara la version del objeto.
   *
   * Viajan con el objeto porque el cliente no tiene el registro, y sin ellas los renderizadores
   * volverian a leer por posicion — que es justo lo que este cambio quita.
   */
  ranuras?: RanuraDeCampos[];
  /**
   * El icono que declara la VERSION del objeto.
   *
   * Viaja con el objeto por el mismo motivo que las ranuras: el cliente no tiene el registro. Sin
   * esto, la tarjeta necesitaba su propio mapa de `objectId` a icono — y ese mapa se quedaba sin
   * entrada cada vez que se publicaba un objeto nuevo, sin fallar ni avisar.
   */
  icono?: NombreDeIcono;
  /**
   * Con que operador se resume cada medida, alineado con `instance.binding.measures`.
   *
   * Resuelto en el servidor contra el esquema del cache, igual que las ranuras: el cliente no
   * tiene el esquema y no puede deducirlo. Que viaje UNA lista es lo que impide que el grafico en
   * pantalla y el archivo exportado resuman con operadores distintos.
   */
  agregaciones: Agregacion[];
  unresolvedObject?: string;
  generatedAt?: string;
  stale?: boolean;
  /**
   * El contenido de un contenedor, ya serializado.
   *
   * Va anidado y no como una lista plana con un puntero al padre por el mismo motivo que los
   * complementos: un objeto dentro de un contenedor no existe fuera de el, y con una lista plana
   * habria que acordarse de borrarlo cuando se borra el contenedor.
   */
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
    agregaciones: objeto.agregaciones,
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

/**
 * Las ranuras declaradas por la version que la instancia fija.
 *
 * Devuelve `undefined` si el objeto o la version no se resuelven: es el caso del objeto roto, que
 * se dibuja marcado y sin datos, y ahi las ranuras no aportan nada.
 */
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
