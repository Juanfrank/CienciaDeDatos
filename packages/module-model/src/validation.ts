import {
  type BindingProblem,
  type ObjectRegistry,
  validateBinding,
} from '@app/ui-components';
import type { ModuleDefinition } from './ModuleDefinition';
import { type GridProblem, validateLayout } from './grid';

/**
 * Validacion de esquema en cada carga del editor — seccion 4.2.
 *
 * "Si un campo mapeado ya no existe en el modelo, marcarlo visualmente roto, NO FALLAR EN
 * SILENCIO." Por eso todo aqui devuelve diagnosticos en vez de lanzar: el editor tiene que
 * poder dibujar el modulo con sus objetos rotos senalados, no quedarse en blanco.
 */

export interface ItemDiagnostic {
  itemId: string;
  objectId: string;
  version: string;
  /** El objeto no existe en el repositorio, o no en esa version. */
  unresolvedObject?: string;
  /** Problemas de mapeo: campo inexistente o contrato incumplido. */
  bindingProblems: BindingProblem[];
  /** true si el objeto no puede dibujarse y hay que marcarlo roto. */
  broken: boolean;
}

export interface ModuleDiagnostics {
  moduleId: string;
  items: ItemDiagnostic[];
  layoutProblems: GridProblem[];
  /** true si algo impide que el modulo se dibuje integro. */
  hasBrokenItems: boolean;
}

export interface ValidateModuleInput {
  module: ModuleDefinition;
  registry: ObjectRegistry;
  /**
   * Columnas disponibles por dataset, tal como el job de poblacion las dejo en el cache.
   * Se pasan como dato y no se consultan aqui: la validacion es una funcion pura.
   */
  columnsByDataset: Record<string, string[]>;
}

export function validateModule(input: ValidateModuleInput): ModuleDiagnostics {
  const { module, registry, columnsByDataset } = input;
  const items: ItemDiagnostic[] = [];
  const layoutProblems: GridProblem[] = [];

  for (const page of module.pages) {
    layoutProblems.push(...validateLayout(page.items.map((i) => ({ id: i.id, position: i.position }))));

    for (const item of page.items) {
      const { instance } = item;
      const diagnostico: ItemDiagnostic = {
        itemId: item.id,
        objectId: instance.objectId,
        version: instance.version,
        bindingProblems: [],
        broken: false,
      };

      let contrato;
      try {
        contrato = registry.resolve(instance.objectId, instance.version).dataContract;
      } catch (error) {
        // Un objeto o una version que ya no existe no tumba el editor: se marca roto.
        diagnostico.unresolvedObject = error instanceof Error ? error.message : String(error);
        diagnostico.broken = true;
        items.push(diagnostico);
        continue;
      }

      const columnas = columnsByDataset[instance.binding.datasetId];
      if (!columnas) {
        diagnostico.bindingProblems.push({
          slot: instance.binding.datasetId,
          kind: 'campo-inexistente',
          problem:
            `El dataset '${instance.binding.datasetId}' no esta disponible en el cache. ` +
            `O no esta en el registro de datasets, o el job aun no lo ha poblado.`,
        });
        diagnostico.broken = true;
        items.push(diagnostico);
        continue;
      }

      diagnostico.bindingProblems = validateBinding(instance, contrato, columnas);
      diagnostico.broken = diagnostico.bindingProblems.length > 0;
      items.push(diagnostico);
    }
  }

  return {
    moduleId: module.moduleId,
    items,
    layoutProblems,
    hasBrokenItems: items.some((i) => i.broken),
  };
}

/**
 * Puerta de publicacion institucional.
 *
 * Un modulo con objetos rotos, con la disposicion invalida o con instancias en versiones ya
 * vencidas no puede publicarse a nivel institucional. Publicarlo seria propagar el fallo a
 * todos los equipos que lo vean.
 */
export interface PublishBlocker {
  reason: string;
  detail: string;
}

export function findPublishBlockers(
  diagnostics: ModuleDiagnostics,
  expiredInstanceIds: string[] = [],
): PublishBlocker[] {
  const bloqueos: PublishBlocker[] = [];

  for (const item of diagnostics.items.filter((i) => i.broken)) {
    bloqueos.push({
      reason: 'objeto-roto',
      detail:
        item.unresolvedObject ??
        `'${item.itemId}': ${item.bindingProblems.map((p) => p.problem).join(' ')}`,
    });
  }

  for (const problema of diagnostics.layoutProblems) {
    bloqueos.push({ reason: `disposicion-${problema.kind}`, detail: problema.problem });
  }

  for (const instanceId of expiredInstanceIds) {
    bloqueos.push({
      reason: 'version-vencida',
      detail: `La instancia '${instanceId}' usa una version de objeto cuya fecha limite de deprecacion ya paso (4.5).`,
    });
  }

  return bloqueos;
}
