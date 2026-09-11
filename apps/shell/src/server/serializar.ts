import type { QueryResult } from '@app/data-contracts';
import type { GridPosition } from '@app/module-model';
import type { BindingProblem, ObjectInstance } from '@app/ui-components';
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
  unresolvedObject?: string;
  generatedAt?: string;
  stale?: boolean;
}

export function serializarObjeto(objeto: ObjetoCargado): ObjetoSerializado {
  const { item } = objeto;
  return {
    itemId: item.id,
    titulo: item.instance.title ?? item.instance.objectId,
    position: item.position,
    instance: item.instance,
    ...(objeto.result ? { result: objeto.result } : {}),
    problems: objeto.problems,
    ...(objeto.unresolvedObject ? { unresolvedObject: objeto.unresolvedObject } : {}),
    ...(objeto.generatedAt ? { generatedAt: objeto.generatedAt } : {}),
    ...(objeto.stale ? { stale: true } : {}),
  };
}
