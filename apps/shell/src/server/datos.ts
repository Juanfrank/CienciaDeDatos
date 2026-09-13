import type { Agregacion, GranoDeDataset, QueryResult, SchemaDescriptor } from '@app/data-contracts';
import { canTeamAccessModule, intersectRequestedFilters, type AccessScope } from '@app/access-control';
import { SCHEMA_CACHE_KEY, type ReadResult, getDataset } from '@app/caching';
import {
  type ColumnaDisponible,
  type DatasetInfo,
  type GridItem,
  type ModuleDefinition,
  type UserPersonalization,
  TIPO_DESCONOCIDO,
  applyPersonalization,
  datasetsConsumedBy,
  findPage,
  validateModule,
} from '@app/module-model';
import {
  type BindingProblem,
  type ConfiguracionDeContenedor,
  agregacionesDe,
  esContenedor,
  noConsumeDatos,
  panelesDe,
  validarContenedor,
  fieldKey,
  ranurasDelContrato,
  validarAgregacion,
  validarRanuras,
  validateBinding,
} from '@app/ui-components';
import { cacheL2, datasetReader, findTeam, getGeneralTree, objectRegistry, scopeFor } from './contexto';

/** Carga de un modulo para una persona concreta. */

export interface ObjetoCargado {
  item: GridItem;
  /** Resultado ya filtrado por el ambito de quien mira. Ausente si el objeto esta roto. */
  result?: QueryResult;
  /** Estado de la lectura del cache: ok, degradado o "generandose". */
  readStatus: ReadResult['status'];
  generatedAt?: string;
  stale?: boolean;
  /** Problemas de mapeo. Si hay alguno, el objeto se dibuja MARCADO COMO ROTO (4.2). */
  problems: BindingProblem[];
  /** Con que operador se resume cada medida, alineado con `binding.measures`. */
  agregaciones: Agregacion[];
  unresolvedObject?: string;
  /** Lo que hay dentro de un contenedor, ya cargado por el mismo camino que lo de fuera. */
  paneles?: PanelCargado[];
}

/** Un panel de contenedor con sus objetos ya cargados. Un contenedor sin pestanas tiene uno. */
export interface PanelCargado {
  panelId: string;
  nombre: string;
  objetos: ObjetoCargado[];
}

export interface ModuloCargado {
  module: ModuleDefinition;
  pageSlug: string;
  objetos: ObjetoCargado[];
  /** Filtros efectivamente aplicados, tras intersecar los de la URL con el ambito. */
  appliedFilters: Record<string, string[]>;
  /** Marca de tiempo del dato mas antiguo servido, para mostrarla en el modulo (4.8). */
  generatedAt?: string;
  /** true si algo se sirvio degradado desde L1 porque L2 no respondia (6.9). */
  degraded: boolean;
  /** true si lo que se devuelve es la vista PERSONALIZADA de esta persona y no la institucional. */
  isPersonalized: boolean;
}

/** Filtros sin los que corresponden a las dimensiones propias del objeto. */
function sinFiltroPropio(
  filtros: Record<string, string | string[]>,
  propias: { table: string; field: string }[],
): Record<string, string | string[]> {
  const claves = new Set(propias.map(fieldKey));
  return Object.fromEntries(Object.entries(filtros).filter(([clave]) => !claves.has(clave)));
}

/** Lee los datos de una lista de objetos bajo UN ambito. */
async function leerObjetos(
  items: GridItem[],
  scope: AccessScope,
  requestedFilters: Record<string, string | string[]>,
): Promise<{ objetos: ObjetoCargado[]; masAntiguo?: string; degraded: boolean }> {
  const objetos: ObjetoCargado[] = [];
  let masAntiguo: string | undefined;
  let degraded = false;
  const declaradas = await agregacionesDeclaradas();

  for (const item of items) {
    const { instance } = item;

    let contrato;
    try {
      contrato = objectRegistry.resolve(instance.objectId, instance.version).dataContract;
    } catch (error) {
      objetos.push({
        item,
        readStatus: 'generating',
        problems: [],
        agregaciones: [],
        unresolvedObject: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    /*
     * Un objeto que no consume datos no consulta el cache.
     */
    if (noConsumeDatos(contrato)) {
      const config = instance.configuracion;
      let paneles: PanelCargado[] | undefined;

      if (esContenedor(instance.objectId)) {
        paneles = [];
        for (const panel of panelesDe(config as ConfiguracionDeContenedor | undefined)) {
          const dentro = await leerObjetos(
            panel.items.map((i) => ({ id: i.id, instance: i.instance, position: i.position })),
            scope,
            requestedFilters,
          );
          /*
           * La frescura y la degradacion de lo de DENTRO cuentan como las de fuera.
           */
          if (dentro.degraded) degraded = true;
          if (dentro.masAntiguo && (!masAntiguo || dentro.masAntiguo < masAntiguo)) {
            masAntiguo = dentro.masAntiguo;
          }
          paneles.push({ panelId: panel.panelId, nombre: panel.nombre, objetos: dentro.objetos });
        }
      }

      objetos.push({
        item,
        readStatus: 'ok',
        problems: validarContenedor(item.id, instance).map((p) => ({
          slot: p.slot,
          kind: 'contrato-incumplido' as const,
          problem: p.problema,
        })),
        agregaciones: [],
        ...(paneles ? { paneles } : {}),
      });
      continue;
    }

    // Un segmentador NO se filtra a si mismo. Si lo hiciera, al elegir un valor desapareceria
    // el resto de opciones y no se podria seleccionar un segundo ni volver atras.
    //
    // Quitar su propio filtro NO debilita el aislamiento: el ambito se aplica dentro del lector
    // (filterResultByScope), de forma independiente de estos filtros, asi que un segmentador
    // sigue sin poder ofrecer valores fuera del alcance de quien mira.
    const filtrosParaEsteObjeto =
      instance.objectId === 'segmentador'
        ? sinFiltroPropio(requestedFilters, instance.binding.dimensions)
        : requestedFilters;

    const lectura = await datasetReader.read({
      datasetId: instance.binding.datasetId,
      scope,
      requestedFilters: filtrosParaEsteObjeto,
    });

    if (lectura.status === 'generating' || !lectura.result) {
      objetos.push({ item, readStatus: 'generating', problems: [], agregaciones: [] });
      continue;
    }

    const columnas = lectura.result.columns.map((c) => c.name);
    /*
     * Las ranuras se comprueban AQUI tambien, no solo en `validateModule`.
     */
    const agregaciones = agregacionesDe(
      instance.binding.measures,
      declaradas,
      instance.binding.agregaciones,
    );

    const problems = [
      ...validateBinding(instance, contrato, columnas),
      ...validarRanuras(instance, ranurasDelContrato(contrato)).map((p) => ({
        slot: `ranura.${p.ranura}`,
        kind: 'contrato-incumplido' as const,
        problem: p.problema,
      })),
      /*
       * La agregacion se comprueba AQUI, en el camino de lectura, y no solo al guardar.
       */
      ...validarAgregacion({
        measures: instance.binding.measures,
        agregaciones,
        colapsa: colapsaElDataset(instance.binding.datasetId, instance.binding.dimensions),
        grano: granoDe(instance.binding.datasetId),
      }).map((p) => ({
        slot: `agregacion.${p.medida}`,
        kind: 'contrato-incumplido' as const,
        problem: p.problema,
      })),
    ];

    if (lectura.stale) degraded = true;
    if (lectura.generatedAt && (!masAntiguo || lectura.generatedAt < masAntiguo)) {
      masAntiguo = lectura.generatedAt;
    }

    objetos.push({
      item,
      result: lectura.result,
      readStatus: lectura.status,
      ...(lectura.generatedAt ? { generatedAt: lectura.generatedAt } : {}),
      ...(lectura.stale ? { stale: true } : {}),
      problems,
      agregaciones,
    });
  }


  return { objetos, ...(masAntiguo ? { masAntiguo } : {}), degraded };
}

export async function cargarModulo(input: {
  module: ModuleDefinition;
  pageSlug?: string;
  userId: string;
  teamId: string;
  /** Filtros pedidos por la query string, ya parseados (4.11). */
  requestedFilters: Record<string, string | string[]>;
  /** Personalizacion de esta persona para este modulo, si la hay (4.6). */
  personalization?: UserPersonalization | undefined;
}): Promise<ModuloCargado | null> {
  const { userId, teamId, requestedFilters } = input;

  // La personalizacion se aplica ANTES de resolver la pagina: puede haber ocultado objetos, y
  // lo que no esta en la vista no se lee del cache ni viaja al navegador.
  const { module, isPersonalized } = applyPersonalization(input.module, input.personalization);

  const page = findPage(module, input.pageSlug);
  if (!page) return null;

  // Comprobacion de ACCESO, distinta de la de ambito.
  //
  // El arbol de navegacion ya oculta lo no concedido, pero ocultar no es proteger: una URL
  // escrita a mano llega igual aqui. La seccion 9 lo dice literalmente — la comprobacion tiene
  // que estar en el backend, "no solo ocultamiento de UI".
  //
  // Sin esto, un modulo que existe en la organizacion general pero que el equipo NO tiene entre
  // sus grantedNodes se renderizaria con el ambito por defecto del equipo, que es una fuga.
  const team = await findTeam(teamId);
  if (!team || !canTeamAccessModule(await getGeneralTree(), team, module.moduleId)) return null;

  const resolucion = await scopeFor(userId, teamId, module.moduleId);
  // Sin ambito resoluble, el modulo no existe para esta persona. Resultado vacio y explicito,
  // nunca un error que revele que existe algo fuera de su alcance (4.11).
  const scope: AccessScope = resolucion?.scope ?? { restrictions: [{ dimension: { table: '', field: '' }, allowedValues: [] }] };

  const appliedFilters = intersectRequestedFilters(scope, requestedFilters);
  const { objetos, masAntiguo, degraded } = await leerObjetos(page.items, scope, requestedFilters);

  return {
    module,
    pageSlug: page.slug,
    objetos,
    appliedFilters,
    ...(masAntiguo ? { generatedAt: masAntiguo } : {}),
    degraded,
    isPersonalized,
  };
}

/** Diagnosticos del modulo para el editor, con las columnas realmente presentes en el cache. */
export async function diagnosticarModulo(module: ModuleDefinition, userId: string, teamId: string) {
  const resolucion = await scopeFor(userId, teamId, module.moduleId);
  if (!resolucion) return null;

  const columnsByDataset: Record<string, ColumnaDisponible[]> = {};
  const datasets = new Set(datasetsConsumedBy(module));

  for (const datasetId of datasets) {
    const lectura = await datasetReader.read({ datasetId, scope: resolucion.scope });
    // El TIPO viaja entero, no solo el nombre: el panel de filtros valida por tipo, y hasta
    // ahora se descartaba aqui mismo.
    if (lectura.result) columnsByDataset[datasetId] = lectura.result.columns;
  }

  return validateModule({
    module,
    registry: objectRegistry,
    columnsByDataset,
    datasets: infoDeDatasets(datasets),
    agregacionesDeclaradas: Object.fromEntries(await agregacionesDeclaradas()),
  });
}

/** Diagnosticos para el EDITOR, sin ambito de por medio. */
export async function diagnosticarDefinicion(module: ModuleDefinition) {
  const columnsByDataset: Record<string, ColumnaDisponible[]> = {};

  const datasets = new Set(datasetsConsumedBy(module));

  for (const datasetId of datasets) {
    columnsByDataset[datasetId] = await columnasDisponiblesDe(datasetId);
  }

  return validateModule({
    module,
    registry: objectRegistry,
    columnsByDataset,
    datasets: infoDeDatasets(datasets),
    agregacionesDeclaradas: Object.fromEntries(await agregacionesDeclaradas()),
  });
}

/**
 * Columnas que un dataset ofrece HOY: lo que declara el registro y el esquema sigue reconociendo.
 */
export async function columnasDisponiblesDe(datasetId: string): Promise<ColumnaDisponible[]> {
  let declarado;
  try {
    declarado = getDataset(datasetId);
  } catch {
    // Dataset fuera del registro: sin columnas, y `validateModule` lo marca roto con su propio
    // mensaje, que ya explica que todo dataset cacheable se declara en el registro.
    return [];
  }

  const dimensiones = (declarado.query.dimensions ?? []).map(fieldKey);
  const medidas = declarado.query.measures ?? [];

  const schema = await esquemaEnCache();

  // Sin esquema en el cache no se conoce el tipo de nada. Se dice, en vez de suponer: una
  // validacion por tipo sobre un tipo inventado rechaza configuraciones correctas.
  if (!schema) {
    return [...dimensiones, ...medidas].map((name) => ({ name, type: TIPO_DESCONOCIDO }));
  }

  return [
    ...dimensiones
      .filter((clave) => campoExisteEnEsquema(schema, clave))
      .map((name) => ({ name, type: tipoEnEsquema(schema, name) })),
    ...medidas
      .filter((medida) => schema.measures.some((m) => m.name === medida))
      .map((name) => ({ name, type: 'number' })),
  ];
}

/**
 * Grano y dimensiones de cada dataset, del registro, para que la validacion pueda comprobar la
 * agregacion. Un dataset fuera del registro se omite: el objeto ya se marca roto por su propia
 * via, y suponerle un grano solo añadiria un segundo mensaje sobre el mismo fallo.
 */
function infoDeDatasets(ids: Iterable<string>): Record<string, DatasetInfo> {
  const info: Record<string, DatasetInfo> = {};
  for (const datasetId of ids) {
    try {
      const d = getDataset(datasetId);
      info[datasetId] = {
        grain: d.grain,
        dimensions: (d.query.dimensions ?? []).map(fieldKey),
      };
    } catch {
      // Fuera del registro: sin info, la comprobacion de agregacion se abstiene.
    }
  }
  return info;
}

/** El grano declarado de un dataset, y si el objeto lo colapsa. */
function granoDe(datasetId: string): GranoDeDataset {
  try {
    return getDataset(datasetId).grain;
  } catch {
    // Dataset fuera del registro: el objeto ya se marca roto por su propia via, y suponer el
    // grano mas permisivo aqui solo añadiria un segundo mensaje sobre el mismo fallo.
    return 'atomico';
  }
}

function colapsaElDataset(datasetId: string, dimensiones: { table: string; field: string }[]): boolean {
  let declaradas: string[];
  try {
    declaradas = (getDataset(datasetId).query.dimensions ?? []).map(fieldKey);
  } catch {
    return false;
  }
  const mostradas = new Set(dimensiones.map(fieldKey));
  return declaradas.some((d) => !mostradas.has(d));
}

/** Que operador declara el esquema para cada medida. */
export async function agregacionesDeclaradas(): Promise<Map<string, Agregacion>> {
  const schema = await esquemaEnCache();
  return new Map((schema?.measures ?? []).map((m) => [m.name, m.aggregation]));
}

const esquemaEnCache = async (): Promise<SchemaDescriptor | null> => {
  try {
    return (await cacheL2.get<SchemaDescriptor>(SCHEMA_CACHE_KEY))?.value ?? null;
  } catch {
    return null;
  }
};

function tipoEnEsquema(schema: SchemaDescriptor, clave: string): string {
  const [tabla, campo] = clave.split('.');
  const encontrado = schema.tables
    .find((t) => t.name === tabla)
    ?.fields.find((f) => f.name === campo);
  return encontrado?.type ?? TIPO_DESCONOCIDO;
}

function campoExisteEnEsquema(schema: SchemaDescriptor, clave: string): boolean {
  const [tabla, campo] = clave.split('.');
  return schema.tables.some(
    (t) => t.name === tabla && t.fields.some((f) => f.name === campo && !f.isMeasure),
  );
}

/** Vista previa de un BORRADOR, para el editor. */
export async function vistaPreviaDelBorrador(input: {
  module: ModuleDefinition;
  pageSlug?: string;
  userId: string;
  teamId: string;
}): Promise<{ objetos: ObjetoCargado[]; pageSlug: string } | null> {
  const page = findPage(input.module, input.pageSlug);
  if (!page) return null;

  const resolucion = await scopeFor(input.userId, input.teamId, input.module.moduleId);
  if (!resolucion) return null;

  /*
   * Un borrador NO esta en el arbol general, asi que `resolveEffectiveScope` devuelve su ambito
   * centinela de «no permite nada»: una restriccion sobre una dimension vacia. Ese centinela es
   * un MARCADOR, no un filtro — el lector no sabe filtrar por una columna que no existe y lanza—,
   * y en la vista normal nunca llega tan lejos porque la comprobacion de acceso corta antes.
   */
  const general = resolucion.steps[0]?.result;
  const scope: AccessScope = resolucion.moduleExistsInGeneralTree
    ? resolucion.scope
    : (general ?? resolucion.scope);

  // Sin filtros: el editor construye la vista institucional, no una consulta concreta. Los
  // filtros son de quien mira el modulo publicado, no de quien lo disena.
  const { objetos } = await leerObjetos(page.items, scope, {});
  return { objetos, pageSlug: page.slug };
}
