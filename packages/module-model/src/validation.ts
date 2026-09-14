import type { Aggregation, DatasetGrain } from '@app/data-contracts';
import {
  type BindingProblem,
  type ObjectInstance,
  type ObjectRegistry,
  aggregationsOf,
  fieldKey,
  contractSlots,
  validateAggregation,
  validatePanelFilters,
  validatePresentation,
  validateSlots,
  validateAttachments,
  validateBinding,
  noConsumeDatos,
  validateContainer,
} from '@app/ui-components';
import type { ModuleDefinition } from './ModuleDefinition';
import { type GridProblem, validateLayout } from './grid';

/** Validacion de esquema en cada carga del editor — seccion 4.2. */

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

/** Una columna disponible: su nombre Y SU TIPO. */
export interface ColumnaDisponible {
  name: string;
  type: string;
}

export const TIPO_DESCONOCIDO = 'desconocido';

export const normalizarColumna = (c: ColumnaDisponible | string): ColumnaDisponible =>
  typeof c === 'string' ? { name: c, type: TIPO_DESCONOCIDO } : c;

/** Lo que hay que saber de un dataset, ademas de sus columnas, para validar la agregacion. */
export interface DatasetInfo {
  grain: DatasetGrain;
  /** Las dimensiones que el dataset trae, en clave `Tabla.Campo`. */
  dimensions: string[];
}

export interface ValidateModuleInput {
  module: ModuleDefinition;
  registry: ObjectRegistry;
  /**
   * Columnas disponibles por dataset, tal como el job de poblacion las dejo en el cache.
   * Se pasan como dato y no se consultan aqui: la validacion es una funcion pura.
   */
  columnsByDataset: Record<string, (ColumnaDisponible | string)[]>;
  /** Grano y dimensiones de cada dataset, del registro. */
  datasets?: Record<string, DatasetInfo>;
  /** Que operador declara el esquema para cada medida. Sin el, cada medida cae en `suma`. */
  agregacionesDeclaradas?: Record<string, Aggregation>;
}

function aggregationProblems(
  instance: ObjectInstance,
  input: ValidateModuleInput,
): BindingProblem[] {
  const info = input.datasets?.[instance.binding.datasetId];
  if (!info) return [];

  const declared = new Map(Object.entries(input.agregacionesDeclaradas ?? {}));
  const aggregations = aggregationsOf(
    instance.binding.measures,
    declared,
    instance.binding.aggregations,
  );
  // Colapsa si el objeto muestra menos dimensiones de las que el dataset trae. Se compara por
  // conjunto y no por cantidad: tres dimensiones que no sean las tres del dataset tambien colapsan.
  const mostradas = new Set(instance.binding.dimensions.map(fieldKey));
  const colapsa = info.dimensions.some((d) => !mostradas.has(d));

  return validateAggregation({
    measures: instance.binding.measures,
    aggregations,
    colapsa,
    dataGrain: info.grain,
  }).map((p) => ({
    slot: `agregacion.${p.medida}`,
    kind: 'contrato-incumplido' as const,
    problem: p.issue,
  }));
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

      let version;
      try {
        version = registry.resolve(instance.objectId, instance.version);
      } catch (error) {
        // Un objeto o una version que ya no existe no tumba el editor: se marca roto.
        diagnostico.unresolvedObject = error instanceof Error ? error.message : String(error);
        diagnostico.broken = true;
        items.push(diagnostico);
        continue;
      }
      const contrato = version.dataContract;

      /*
       * Un objeto que no consume datos no tiene dataset que comprobar.
       */
      if (noConsumeDatos(contrato)) {
        // Se comprueba lo que SI tiene sentido sin dataset: los complementos y la presentacion.
        // Saltarselo todo dejaria a estos objetos como los unicos donde un icono inexistente o un
        // acento que no es rol del tema se descubre al dibujar.
        diagnostico.bindingProblems = [
          ...validateAttachments(instance, (objectId) => registry.get(objectId)),
          ...validatePresentation(instance.presentacion, version.presentation).map((p) => ({
            slot: `presentacion.${p.clave}`,
            kind: 'contrato-incumplido' as const,
            problem: p.issue,
          })),
          ...validateContainer(item.id, instance).map((p) => ({
            slot: p.slot,
            kind: 'contrato-incumplido' as const,
            problem: p.issue,
          })),
        ];
        diagnostico.broken = diagnostico.bindingProblems.length > 0;
        items.push(diagnostico);
        continue;
      }

      const columnasCrudas = columnsByDataset[instance.binding.datasetId];
      if (!columnasCrudas) {
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
      const gridColumns = columnasCrudas.map(normalizarColumna);
      const fieldKinds = Object.fromEntries(gridColumns.map((c) => [c.name, c.type]));

      diagnostico.bindingProblems = [
        ...validateBinding(instance, contrato, gridColumns.map((c) => c.name)),
        // Los complementos se validan en el MISMO sitio que el mapeo, y no aparte: colocar un
        // complemento suelto en la rejilla es un error de configuracion como cualquier otro, y
        // tiene que bloquear la publicacion igual que un campo inexistente.
        ...validateAttachments(instance, (objectId) => registry.get(objectId)),
        /*
         * Y la presentacion, por el mismo motivo.
         */
        /*
         * Las ranuras, ademas del contrato global.
         */
        ...validateSlots(instance, contractSlots(contrato)).map((p) => ({
          slot: `ranura.${p.ranura}`,
          kind: 'contrato-incumplido' as const,
          problem: p.issue,
        })),
        ...validatePresentation(instance.presentacion, version.presentation).map((p) => ({
          slot: `presentacion.${p.clave}`,
          kind: 'contrato-incumplido' as const,
          problem: p.issue,
        })),
        /*
         * Y la configuracion propia del tipo.
         */
        ...(instance.settings?.objectId === 'panel-de-filtros'
          ? validatePanelFilters(instance, instance.settings, fieldKinds).map((p) => ({
              slot: `filtros.${p.fieldName}`,
              kind: 'contrato-incumplido' as const,
              problem: p.issue,
            }))
          : []),
        /*
         * Y como se resume cada medida.
         */
        ...aggregationProblems(instance, input),
      ];
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

/** Puerta de publicacion institucional. */
export interface PublishBlocker {
  reason: string;
  detail: string;
}

export function findPublishBlockers(
  diagnostics: ModuleDiagnostics,
  expiredInstanceIds: string[] = [],
): PublishBlocker[] {
  const locks: PublishBlocker[] = [];

  for (const item of diagnostics.items.filter((i) => i.broken)) {
    locks.push({
      reason: 'objeto-roto',
      detail:
        item.unresolvedObject ??
        `'${item.itemId}': ${item.bindingProblems.map((p) => p.problem).join(' ')}`,
    });
  }

  for (const issue of diagnostics.layoutProblems) {
    locks.push({ reason: `disposicion-${issue.kind}`, detail: issue.problem });
  }

  for (const instanceId of expiredInstanceIds) {
    locks.push({
      reason: 'version-vencida',
      detail: `La instancia '${instanceId}' usa una version de objeto cuya fecha limite de deprecacion ya paso (4.5).`,
    });
  }

  return locks;
}
