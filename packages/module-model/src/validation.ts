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
  notConsumesData,
  validateContainer,
} from '@app/ui-components';
import type { ModuleDefinition } from './ModuleDefinition';
import { navigatorProblems } from './pageNavigator';
import { drillProblems } from './interaction';
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
  /**
   * Lo que impide NAVEGAR el modulo: un modulo de varias paginas sin navegador elegido.
   *
   * Va con los demas diagnosticos y no en una comprobacion aparte porque es de la misma clase que
   * un objeto roto: el modulo se dibuja, pero no se puede usar entero. Un modulo de seis paginas
   * publicado sin navegador ensena una y esconde cinco, y quien lo abre no tiene forma de saber
   * que estan ahi.
   */
  navigationProblems: string[];
  /**
   * Lo que impide que un salto a otro modulo (4.4) lleve a alguna parte.
   *
   * Aparte de `items` porque no rompe el objeto: la tarjeta se dibuja igual y la cifra es
   * correcta; lo que no esta es el camino que alguien declaro. Marcarla rota escondería la cifra
   * por un problema que no es suyo.
   */
  drillProblems: string[];
  /** true si algo impide que el modulo se dibuje integro. */
  hasBrokenItems: boolean;
}

/** Una columna disponible: su nombre Y SU TIPO. */
export interface AvailableColumn {
  name: string;
  type: string;
}

export const UNKNOWN_KIND = 'desconocido';

export const columnNormalize = (c: AvailableColumn | string): AvailableColumn =>
  typeof c === 'string' ? { name: c, type: UNKNOWN_KIND } : c;

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
  columnsByDataset: Record<string, (AvailableColumn | string)[]>;
  /** Grano y dimensiones de cada dataset, del registro. */
  datasets?: Record<string, DatasetInfo>;
  /** Que operador declara el esquema para cada medida. Sin el, cada medida cae en `suma`. */
  declaredAggregations?: Record<string, Aggregation>;
  /**
   * Direcciones de modulo que existen hoy, para comprobar a donde apuntan los saltos de 4.4.
   *
   * Se pasa como dato —igual que las columnas— porque la validacion es una funcion pura: quien
   * la llama sabe consultar el catalogo de modulos, ella no.
   *
   * Ausente significa «no se comprueba», no «ninguno existe»: sin esto, validar un modulo desde
   * una prueba que no monta el catalogo marcaria todos sus saltos como rotos.
   */
  moduleSlugs?: readonly string[];
}

function aggregationProblems(
  instance: ObjectInstance,
  input: ValidateModuleInput,
): BindingProblem[] {
  const info = input.datasets?.[instance.binding.datasetId];
  if (!info) return [];

  const declared = new Map(Object.entries(input.declaredAggregations ?? {}));
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
      if (notConsumesData(contrato)) {
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

      const rawColumns = columnsByDataset[instance.binding.datasetId];
      if (!rawColumns) {
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
      const gridColumns = rawColumns.map(columnNormalize);
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
          kind: p.kind,
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
    navigationProblems: navigatorProblems(module),
    drillProblems: saltosProblems(input),
    hasBrokenItems: items.some((i) => i.broken),
  };
}

/**
 * Los saltos de todas las paginas, con el objeto que los declara delante.
 *
 * Sin el nombre del objeto el aviso diria «el salto apunta a un modulo que no existe» sobre un
 * modulo de veinte tarjetas, y habria que abrirlas una a una para encontrar cual.
 */
function saltosProblems(input: ValidateModuleInput): string[] {
  if (input.moduleSlugs === undefined) return [];

  const problemas: string[] = [];
  const contexto = { moduleSlug: input.module.slug, slugsExistentes: input.moduleSlugs };

  for (const page of input.module.pages) {
    for (const item of page.items) {
      for (const problema of drillProblems(item.instance, contexto)) {
        problemas.push(`'${item.instance.title ?? item.id}': ${problema}`);
      }
    }
  }

  return problemas;
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
      reason: 'object-broken',
      detail:
        item.unresolvedObject ??
        `'${item.itemId}': ${item.bindingProblems.map((p) => p.problem).join(' ')}`,
    });
  }

  for (const issue of diagnostics.layoutProblems) {
    locks.push({ reason: `disposicion-${issue.kind}`, detail: issue.problem });
  }

  for (const detail of diagnostics.navigationProblems) {
    locks.push({ reason: 'navegacion', detail });
  }

  // Un salto roto bloquea igual que la navegacion: publicar un modulo con un camino que no lleva
  // a ningun sitio es publicar una promesa que se rompe al pulsarla.
  for (const detail of diagnostics.drillProblems) {
    locks.push({ reason: 'salto', detail });
  }

  for (const instanceId of expiredInstanceIds) {
    locks.push({
      reason: 'version-vencida',
      detail: `La instancia '${instanceId}' usa una version de objeto cuya fecha limite de deprecacion ya paso (4.5).`,
    });
  }

  return locks;
}
