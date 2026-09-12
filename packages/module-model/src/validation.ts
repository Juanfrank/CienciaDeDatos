import type { Agregacion, GranoDeDataset } from '@app/data-contracts';
import {
  type BindingProblem,
  type ObjectInstance,
  type ObjectRegistry,
  agregacionesDe,
  fieldKey,
  ranurasDelContrato,
  validarAgregacion,
  validarPanelDeFiltros,
  validarPresentacion,
  validarRanuras,
  validateAttachments,
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

/**
 * Una columna disponible: su nombre Y SU TIPO.
 *
 * El tipo viajaba y se tiraba —`columns.map(c => c.name)`— porque hasta ahora ninguna validacion
 * lo necesitaba. El panel de filtros si: un selector de calendario sobre una columna de texto es
 * un error de configuracion, y sin el tipo no hay forma de distinguirlo de uno correcto.
 *
 * Se acepta tambien la forma antigua, una cadena suelta, y entonces el tipo queda «desconocido».
 * Es lo honesto para un dataset que el job aun no ha poblado: sin esquema no se sabe el tipo, y
 * inventarse uno haria que la validacion rechazara configuraciones correctas.
 */
export interface ColumnaDisponible {
  name: string;
  type: string;
}

export const TIPO_DESCONOCIDO = 'desconocido';

export const normalizarColumna = (c: ColumnaDisponible | string): ColumnaDisponible =>
  typeof c === 'string' ? { name: c, type: TIPO_DESCONOCIDO } : c;

/**
 * Lo que hay que saber de un dataset, ademas de sus columnas, para validar la agregacion.
 *
 * Es lo que el registro declara (6.6) y no se deduce de las columnas: un dataset de tres columnas
 * de dimension puede ser el detalle de la tabla de hechos o el resultado de agrupar por esas tres,
 * y son cosas distintas — sobre el primero un promedio se calcula, sobre el segundo no.
 */
export interface DatasetInfo {
  grain: GranoDeDataset;
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
  /**
   * Grano y dimensiones de cada dataset, del registro.
   *
   * Opcional: sin esta informacion la comprobacion de agregacion SE ABSTIENE, en vez de suponer
   * un grano. Es el mismo criterio que el tipo `desconocido` de las columnas — inventarse el dato
   * que falta hace que la validacion rechace configuraciones correctas.
   */
  datasets?: Record<string, DatasetInfo>;
  /** Que operador declara el esquema para cada medida. Sin el, cada medida cae en `suma`. */
  agregacionesDeclaradas?: Record<string, Agregacion>;
}

function problemasDeAgregacion(
  instance: ObjectInstance,
  input: ValidateModuleInput,
): BindingProblem[] {
  const info = input.datasets?.[instance.binding.datasetId];
  if (!info) return [];

  const declaradas = new Map(Object.entries(input.agregacionesDeclaradas ?? {}));
  const agregaciones = agregacionesDe(
    instance.binding.measures,
    declaradas,
    instance.binding.agregaciones,
  );
  // Colapsa si el objeto muestra menos dimensiones de las que el dataset trae. Se compara por
  // conjunto y no por cantidad: tres dimensiones que no sean las tres del dataset tambien colapsan.
  const mostradas = new Set(instance.binding.dimensions.map(fieldKey));
  const colapsa = info.dimensions.some((d) => !mostradas.has(d));

  return validarAgregacion({
    measures: instance.binding.measures,
    agregaciones,
    colapsa,
    grano: info.grain,
  }).map((p) => ({
    slot: `agregacion.${p.medida}`,
    kind: 'contrato-incumplido' as const,
    problem: p.problema,
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
      const columnas = columnasCrudas.map(normalizarColumna);
      const tiposPorCampo = Object.fromEntries(columnas.map((c) => [c.name, c.type]));

      diagnostico.bindingProblems = [
        ...validateBinding(instance, contrato, columnas.map((c) => c.name)),
        // Los complementos se validan en el MISMO sitio que el mapeo, y no aparte: colocar un
        // complemento suelto en la rejilla es un error de configuracion como cualquier otro, y
        // tiene que bloquear la publicacion igual que un campo inexistente.
        ...validateAttachments(instance, (objectId) => registry.get(objectId)),
        /*
         * Y la presentacion, por el mismo motivo.
         *
         * Un icono que no existe o un acento que no es un rol del tema son errores de
         * configuracion igual que un campo inexistente, y tienen que salir AQUI —donde el editor
         * los puede senalar antes de guardar— y no al dibujar. Sin esto, el estandar de
         * personalizacion seria un tipo de TypeScript: cierto mientras nadie edite el JSON de un
         * modulo a mano, que es exactamente lo que hace el panel de administracion.
         */
        /*
         * Las ranuras, ademas del contrato global.
         *
         * El contrato dice «entre 1 y 2 dimensiones» y se cumple igual con la dimension en el eje
         * X que en la serie — y solo el primero es un grafico que se puede dibujar. Solo la ranura
         * sabe cual de sus campos hace falta.
         */
        ...validarRanuras(instance, ranurasDelContrato(contrato)).map((p) => ({
          slot: `ranura.${p.ranura}`,
          kind: 'contrato-incumplido' as const,
          problem: p.problema,
        })),
        ...validarPresentacion(instance.presentacion, version.presentation).map((p) => ({
          slot: `presentacion.${p.clave}`,
          kind: 'contrato-incumplido' as const,
          problem: p.problema,
        })),
        /*
         * Y la configuracion propia del tipo.
         *
         * Un calendario sobre una columna de texto no se puede dibujar de ninguna forma sensata, y
         * descubrirlo al renderizar significa un objeto roto en produccion. Aqui el editor lo ve
         * antes de guardar, que es donde 4.2 quiere que se vea.
         */
        ...(instance.configuracion?.objectId === 'panel-de-filtros'
          ? validarPanelDeFiltros(instance, instance.configuracion, tiposPorCampo).map((p) => ({
              slot: `filtros.${p.campo}`,
              kind: 'contrato-incumplido' as const,
              problem: p.problema,
            }))
          : []),
        /*
         * Y como se resume cada medida.
         *
         * Es lo que impide guardar el numero falso. Antes la agregacion no existia como concepto:
         * la capa de presentacion sumaba siempre, asi que mapear una columna de promedios en una
         * tarjeta daba la suma de los promedios sin que nada lo notara. Con el operador declarado
         * y el grano del dataset declarado, la combinacion imposible se puede rechazar AQUI, antes
         * de guardar, que es donde 4.2 quiere que se vea.
         */
        ...problemasDeAgregacion(instance, input),
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
