import { splitFilterKey } from '@app/data-contracts';
import type { Aggregation, DatasetGrain, QueryResult, SchemaDescriptor } from '@app/data-contracts';
import {
  canAccessModule,
  intersectRequestedFilters,
  type AccessScope,
  type GovernedUser,
  type Team,
} from '@app/access-control';
import { NAVIGATOR_IS_PANEL } from '@app/module-model';
import { SCHEMA_CACHE_KEY, type ReadResult, getDataset } from '@app/caching';
import {
  type AvailableColumn,
  type DatasetInfo,
  type GridItem,
  type ModuleDefinition,
  type UserPersonalization,
  UNKNOWN_KIND,
  applyPersonalization,
  datasetsConsumedBy,
  findPage,
  validateModule,
} from '@app/module-model';
import {
  type BindingProblem,
  type ContainerSettings,
  aggregationsOf,
  isContainer,
  notConsumesData,
  panelsOf,
  validateContainer,
  fieldKey,
  contractSlots,
  validateAggregation,
  validateSlots,
  validateBinding,
} from '@app/ui-components';
import { modules } from './moduleStore';
import {
  cacheL2,
  datasetReader,
  findTeam,
  findUser,
  getGeneralTree,
  objectRegistry,
  scopeFor,
} from './context';

/** Carga de un modulo para una persona concreta. */

export interface LoadedObject {
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
  aggregations: Aggregation[];
  unresolvedObject?: string;
  /** Lo que hay dentro de un contenedor, ya cargado por el mismo camino que lo de fuera. */
  panels?: LoadedPanel[];
}

/** Un panel de contenedor con sus objetos ya cargados. Un contenedor sin pestanas tiene uno. */
export interface LoadedPanel {
  panelId: string;
  nombre: string;
  objetos: LoadedObject[];
}

export interface LoadedModule {
  module: ModuleDefinition;
  pageSlug: string;
  objetos: LoadedObject[];
  /** Filtros efectivamente aplicados, tras intersecar los de la URL con el ambito. */
  appliedFilters: Record<string, string[]>;
  /** Marca de tiempo del dato mas antiguo servido, para mostrarla en el modulo (4.8). */
  generatedAt?: string;
  /** true si algo se sirvio degradado desde L1 porque L2 no respondia (6.9). */
  degraded: boolean;
  /** true si lo que se devuelve es la vista PERSONALIZADA de esta persona y no la institucional. */
  isPersonalized: boolean;
  /**
   * La seccion de filtros del navegador lateral, ya leida.
   *
   * Se lee por el MISMO camino que cualquier otro objeto —un `panel-de-filtros` sintetico que pasa
   * por `readObjects`— y no por una consulta aparte. Un segundo camino para leer valores de filtro
   * es un segundo sitio donde aplicar el ambito, y el dia que uno de los dos se olvidara de
   * aplicarlo el panel ofreceria valores que quien mira no puede ver.
   */
  navigatorFilters?: LoadedObject;
  /**
   * Los modulos a los que los saltos de esta pagina pueden llevar a QUIEN MIRA, de slug a nombre.
   *
   * Es la mitad visible de la regla de 4.4: el contexto se interseca con el ambito de quien LLEGA,
   * no con el de quien navego, asi que un salto a un modulo que esta persona no tiene concedido
   * sencillamente no se le ofrece. La otra mitad la pone `/m/{slug}`, que lo rechaza aunque la
   * direccion se escriba a mano — ocultar un enlace no es proteger.
   *
   * Se calcula aqui y no en el navegador porque quien decide que alcanza una persona es el
   * servidor. Solo se miran los slugs que los objetos de esta pagina declaran como destino: no
   * hace falta recorrer la institucion entera para dibujar dos enlaces.
   */
  drillTargets: Record<string, string>;
}

/**
 * Filtros sin los que corresponden a las dimensiones propias del objeto.
 *
 * Quita tambien los que llevan operador —`campo.no`, `campo.contiene`, `campo.desde`…—, no solo
 * el «pertenece a». Mirando unicamente la clave desnuda, excluir un valor en un panel de filtros
 * hacia desaparecer ese valor de su propia lista: quedaba excluido y sin forma de volver a
 * incluirlo, porque el unico control que podia deshacerlo ya no estaba en pantalla.
 */
function ownWithoutFilter(
  filtros: Record<string, string | string[]>,
  propias: { table: string; field: string }[],
): Record<string, string | string[]> {
  const keys = new Set(propias.map(fieldKey));
  return Object.fromEntries(
    Object.entries(filtros).filter(([clave]) => !keys.has(splitFilterKey(clave).field)),
  );
}

/** Lee los datos de una lista de objetos bajo UN ambito. */
async function readObjects(
  items: GridItem[],
  scope: AccessScope,
  requestedFilters: Record<string, string | string[]>,
): Promise<{ objetos: LoadedObject[]; masAntiguo?: string; degraded: boolean }> {
  const objetos: LoadedObject[] = [];
  let masAntiguo: string | undefined;
  let degraded = false;
  const declared = await declaredAggregations();

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
        aggregations: [],
        unresolvedObject: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    /*
     * Un objeto que no consume datos no consulta el cache.
     */
    if (notConsumesData(contrato)) {
      const config = instance.settings;
      let panels: LoadedPanel[] | undefined;

      if (isContainer(instance.objectId)) {
        panels = [];
        for (const panel of panelsOf(config as ContainerSettings | undefined)) {
          const dentro = await readObjects(
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
          panels.push({ panelId: panel.panelId, nombre: panel.nombre, objetos: dentro.objetos });
        }
      }

      objetos.push({
        item,
        readStatus: 'ok',
        problems: validateContainer(item.id, instance).map((p) => ({
          slot: p.slot,
          kind: 'contrato-incumplido' as const,
          problem: p.issue,
        })),
        aggregations: [],
        ...(panels ? { panels } : {}),
      });
      continue;
    }

    /*
     * Un objeto de FILTRO no se filtra a si mismo. Si lo hiciera, al elegir un valor desapareceria
     * el resto de opciones y no se podria elegir un segundo ni volver atras.
     *
     * Se decide por la CATEGORIA del objeto y no por su identificador. Escrito como
     * `objectId === 'segmentador'`, la regla valia solo para el primer objeto de filtro que
     * existio: el panel de filtros, que llego despues, si se filtraba a si mismo —y con el modo
     * «no es», excluir un valor lo borraba de su propia lista y lo dejaba excluido para siempre—.
     *
     * Quitar su propio filtro NO debilita el aislamiento: el ambito se aplica dentro del lector
     * (filterResultByScope), de forma independiente de estos filtros, asi que un objeto de filtro
     * sigue sin poder ofrecer valores fuera del alcance de quien mira.
     */
    const esDeFiltro = objectRegistry.get(instance.objectId)?.category === 'filtro';
    const objectEsteFilters = esDeFiltro
      ? ownWithoutFilter(requestedFilters, instance.binding.dimensions)
      : requestedFilters;

    const lectura = await datasetReader.read({
      datasetId: instance.binding.datasetId,
      scope,
      requestedFilters: objectEsteFilters,
    });

    if (lectura.status === 'generating' || !lectura.result) {
      objetos.push({ item, readStatus: 'generating', problems: [], aggregations: [] });
      continue;
    }

    const gridColumns = lectura.result.columns.map((c) => c.name);
    /*
     * Las ranuras se comprueban AQUI tambien, no solo en `validateModule`.
     */
    const aggregations = aggregationsOf(
      instance.binding.measures,
      declared,
      instance.binding.aggregations,
    );

    const problems = [
      ...validateBinding(instance, contrato, gridColumns),
      ...validateSlots(instance, contractSlots(contrato)).map((p) => ({
        slot: `ranura.${p.ranura}`,
        kind: p.kind,
        problem: p.issue,
      })),
      /*
       * La agregacion se comprueba AQUI, en el camino de lectura, y no solo al guardar.
       */
      ...validateAggregation({
        measures: instance.binding.measures,
        aggregations,
        colapsa: colapsaElDataset(instance.binding.datasetId, instance.binding.dimensions),
        dataGrain: grainOf(instance.binding.datasetId),
      }).map((p) => ({
        slot: `agregacion.${p.medida}`,
        kind: 'contrato-incumplido' as const,
        problem: p.issue,
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
      aggregations,
    });
  }


  return { objetos, ...(masAntiguo ? { masAntiguo } : {}), degraded };
}

export async function moduleLoad(input: {
  module: ModuleDefinition;
  pageSlug?: string;
  userId: string;
  teamId: string;
  /** Filtros pedidos por la query string, ya parseados (4.11). */
  requestedFilters: Record<string, string | string[]>;
  /** Personalizacion de esta persona para este modulo, si la hay (4.6). */
  personalization?: UserPersonalization | undefined;
}): Promise<LoadedModule | null> {
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
  // Sin esto, un modulo que existe en la organizacion general pero que nadie tiene concedido se
  // renderizaria con el ambito por defecto del equipo, que es una fuga.
  //
  // Se pregunta por la PERSONA, no por el equipo: desde que la concesion puede ser individual,
  // preguntar solo por el equipo cerraria la puerta a quien la tiene concedida a su nombre — el
  // menu se la ensenaria y la pagina le respondería que no existe.
  const [team, user] = await Promise.all([findTeam(teamId), findUser(userId)]);
  if (
    !team ||
    !canAccessModule({
      generalTree: await getGeneralTree(),
      team,
      ...(user ? { user } : {}),
      moduleId: module.moduleId,
    })
  ) {
    return null;
  }

  const resolucion = await scopeFor(userId, teamId, module.moduleId);
  // Sin ambito resoluble, el modulo no existe para esta persona. Resultado vacio y explicito,
  // nunca un error que revele que existe algo fuera de su alcance (4.11).
  const scope: AccessScope = resolucion?.scope ?? { restrictions: [{ dimension: { table: '', field: '' }, allowedValues: [] }] };

  const appliedFilters = intersectRequestedFilters(scope, requestedFilters);
  const { objetos, masAntiguo, degraded } = await readObjects(page.items, scope, requestedFilters);

  const navegador = navigatorFiltersItem(module);
  const filtrosDelNavegador = navegador
    ? (await readObjects([navegador], scope, requestedFilters)).objetos[0]
    : undefined;

  return {
    module,
    pageSlug: page.slug,
    objetos,
    appliedFilters,
    ...(masAntiguo ? { generatedAt: masAntiguo } : {}),
    degraded,
    isPersonalized,
    ...(filtrosDelNavegador ? { navigatorFilters: filtrosDelNavegador } : {}),
    drillTargets: await drillReachable(page.items, {
      team,
      ...(user ? { user } : {}),
      moduleSlug: module.slug,
    }),
  };
}

/**
 * De los destinos que los objetos de esta pagina declaran, los que quien mira alcanza de verdad.
 *
 * Se comprueban solo los slugs declarados y no el catalogo entero: dibujar dos enlaces no tiene
 * por que costar una comprobacion de acceso por cada modulo de la institucion.
 *
 * Pasa por `canAccessModule`, la MISMA puerta que `moduleLoad` aplica unas lineas mas arriba. Un
 * segundo criterio para decidir a que alcanza una persona es un segundo sitio donde equivocarse, y
 * el dia que uno de los dos se quedara atras el menu ofreceria un salto que la pagina rechaza.
 */
async function drillReachable(
  items: readonly GridItem[],
  ctx: { team: Team; user?: GovernedUser; moduleSlug: string },
): Promise<Record<string, string>> {
  const pedidos = new Set<string>();
  for (const item of items) {
    for (const destino of item.instance.drillThrough ?? []) {
      if (destino.moduleSlug.trim() !== '') pedidos.add(destino.moduleSlug);
    }
  }
  if (pedidos.size === 0) return {};

  const arbol = await getGeneralTree();
  const definiciones = new Map((await modules.list()).map((m) => [m.slug, m]));
  const alcanzables: Record<string, string> = {};

  for (const slug of pedidos) {
    const destino = definiciones.get(slug);
    // Un borrador o algo retirado no se sirve, asi que tampoco se ofrece como salto: el enlace
    // llevaria a una pagina que responde que no existe.
    if (!destino || destino.status !== 'publicado') continue;
    if (
      canAccessModule({
        generalTree: arbol,
        team: ctx.team,
        ...(ctx.user ? { user: ctx.user } : {}),
        moduleId: destino.moduleId,
      })
    ) {
      alcanzables[slug] = destino.name;
    }
  }

  return alcanzables;
}

/**
 * La seccion de filtros de un panel lateral, expresada como un `panel-de-filtros` cualquiera.
 *
 * Es el truco entero, y esta puesto a proposito: en vez de un lector nuevo para los filtros del
 * navegador, se arma la misma instancia que tendria si alguien la hubiera colocado en el lienzo.
 * Asi el ambito, el cache, la degradacion y la validacion de selectores son literalmente el mismo
 * codigo — y lo que se dibuja arriba son los mismos controles.
 */
function navigatorFiltersItem(module: ModuleDefinition): GridItem | undefined {
  const navegador = module.navigator;
  const filtros = navegador?.filtros;
  if (!navegador || !filtros || filtros.pickers.length === 0) return undefined;
  if (!NAVIGATOR_IS_PANEL(navegador.tipo) || !filtros.datasetId) return undefined;

  const dimensions = filtros.pickers.map((p) => {
    const [table, ...resto] = p.fieldName.split('.');
    return { table: table ?? '', field: resto.join('.') };
  });

  return {
    id: 'navegador-filtros',
    position: { x: 0, y: 0, w: 12, h: 2 },
    instance: {
      instanceId: 'navegador-filtros',
      objectId: 'panel-de-filtros',
      version: '1.0.0',
      title: filtros.etiqueta ?? 'Filtros',
      binding: { datasetId: filtros.datasetId, dimensions, measures: [] },
      settings: { objectId: 'panel-de-filtros', pickers: filtros.pickers },
    },
  };
}

/**
 * Las direcciones de todos los modulos, para comprobar a donde apuntan los saltos de 4.4.
 *
 * Sin filtrar por estado ni por quien mira, y a proposito: un salto a un borrador ajeno no es un
 * salto roto —el borrador existe y se publicara—, y un salto a un modulo que no es de tu equipo
 * tampoco: ahi el destino esta, lo que falta es tu concesion, y eso lo resuelve quien dibuja.
 */
const slugsDeModulo = async (): Promise<string[]> => (await modules.list()).map((m) => m.slug);

/** Diagnosticos del modulo para el editor, con las columnas realmente presentes en el cache. */
export async function moduleDiagnose(module: ModuleDefinition, userId: string, teamId: string) {
  const resolucion = await scopeFor(userId, teamId, module.moduleId);
  if (!resolucion) return null;

  const columnsByDataset: Record<string, AvailableColumn[]> = {};
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
    declaredAggregations: Object.fromEntries(await declaredAggregations()),
    moduleSlugs: await slugsDeModulo(),
  });
}

/** Diagnosticos para el EDITOR, sin ambito de por medio. */
export async function definitionDiagnose(module: ModuleDefinition) {
  const columnsByDataset: Record<string, AvailableColumn[]> = {};

  const datasets = new Set(datasetsConsumedBy(module));

  for (const datasetId of datasets) {
    columnsByDataset[datasetId] = await availableColumnsOf(datasetId);
  }

  return validateModule({
    module,
    registry: objectRegistry,
    columnsByDataset,
    datasets: infoDeDatasets(datasets),
    declaredAggregations: Object.fromEntries(await declaredAggregations()),
    moduleSlugs: await slugsDeModulo(),
  });
}

/**
 * Columnas que un dataset ofrece HOY: lo que declara el registro y el esquema sigue reconociendo.
 */
export async function availableColumnsOf(datasetId: string): Promise<AvailableColumn[]> {
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

  const schema = await cacheScheme();

  // Sin esquema en el cache no se conoce el tipo de nada. Se dice, en vez de suponer: una
  // validacion por tipo sobre un tipo inventado rechaza configuraciones correctas.
  if (!schema) {
    return [...dimensiones, ...medidas].map((name) => ({ name, type: UNKNOWN_KIND }));
  }

  return [
    ...dimensiones
      .filter((clave) => schemeExistsField(schema, clave))
      .map((name) => ({ name, type: schemeKind(schema, name) })),
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
function grainOf(datasetId: string): DatasetGrain {
  try {
    return getDataset(datasetId).grain;
  } catch {
    // Dataset fuera del registro: el objeto ya se marca roto por su propia via, y suponer el
    // grano mas permisivo aqui solo añadiria un segundo mensaje sobre el mismo fallo.
    return 'atomico';
  }
}

function colapsaElDataset(datasetId: string, dimensiones: { table: string; field: string }[]): boolean {
  let declared: string[];
  try {
    declared = (getDataset(datasetId).query.dimensions ?? []).map(fieldKey);
  } catch {
    return false;
  }
  const mostradas = new Set(dimensiones.map(fieldKey));
  return declared.some((d) => !mostradas.has(d));
}

/** Que operador declara el esquema para cada medida. */
export async function declaredAggregations(): Promise<Map<string, Aggregation>> {
  const schema = await cacheScheme();
  return new Map((schema?.measures ?? []).map((m) => [m.name, m.aggregation]));
}

const cacheScheme = async (): Promise<SchemaDescriptor | null> => {
  try {
    return (await cacheL2.get<SchemaDescriptor>(SCHEMA_CACHE_KEY))?.value ?? null;
  } catch {
    return null;
  }
};

function schemeKind(schema: SchemaDescriptor, clave: string): string {
  const [tabla, fieldName] = clave.split('.');
  const encontrado = schema.tables
    .find((t) => t.name === tabla)
    ?.fields.find((f) => f.name === fieldName);
  return encontrado?.type ?? UNKNOWN_KIND;
}

function schemeExistsField(schema: SchemaDescriptor, clave: string): boolean {
  const [tabla, fieldName] = clave.split('.');
  return schema.tables.some(
    (t) => t.name === tabla && t.fields.some((f) => f.name === fieldName && !f.isMeasure),
  );
}

/** Vista previa de un BORRADOR, para el editor. */
export async function draftPreviousView(input: {
  module: ModuleDefinition;
  pageSlug?: string;
  userId: string;
  teamId: string;
}): Promise<{ objetos: LoadedObject[]; pageSlug: string } | null> {
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
  const { objetos } = await readObjects(page.items, scope, {});
  return { objetos, pageSlug: page.slug };
}
