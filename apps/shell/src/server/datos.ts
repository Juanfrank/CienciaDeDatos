import type { QueryResult, SchemaDescriptor } from '@app/data-contracts';
import { canTeamAccessModule, intersectRequestedFilters, type AccessScope } from '@app/access-control';
import { SCHEMA_CACHE_KEY, type ReadResult, getDataset } from '@app/caching';
import {
  type ColumnaDisponible,
  type GridItem,
  type ModuleDefinition,
  type UserPersonalization,
  TIPO_DESCONOCIDO,
  applyPersonalization,
  findPage,
  validateModule,
} from '@app/module-model';
import { type BindingProblem, fieldKey, validateBinding } from '@app/ui-components';
import { cacheL2, datasetReader, findTeam, getGeneralTree, objectRegistry, scopeFor } from './contexto';

/**
 * Carga de un modulo para una persona concreta.
 *
 * Todo el camino ocurre en el servidor: resolver el ambito, leer del cache, filtrar y devolver
 * al navegador datos YA filtrados. El navegador nunca recibe nada que su ambito no permita, y
 * nunca habla con otra cosa que no sea la API de esta aplicacion (principio 1).
 */

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
  unresolvedObject?: string;
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
  /**
   * true si lo que se devuelve es la vista PERSONALIZADA de esta persona y no la institucional.
   *
   * Viaja con los datos y no se decide en la pantalla porque 4.6 pide esa distincion "incluida
   * al exportar/compartir": un PDF que circula por correo sin la marca es exactamente el caso
   * que esa seccion quiere evitar, y la marca tiene que salir del mismo sitio que el contenido.
   */
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

/**
 * Lee los datos de una lista de objetos bajo UN ambito.
 *
 * Se extrae de `cargarModulo` para que la vista previa del editor use exactamente este codigo y
 * no una copia. Es lo que garantiza que la vista previa este recortada por el ambito de quien
 * edita: si fuera un camino aparte, el editor seria una forma de ver datos fuera del alcance
 * propio sin mas que crear un borrador, y ninguna prueba de la vista normal lo detectaria.
 */
async function leerObjetos(
  items: GridItem[],
  scope: AccessScope,
  requestedFilters: Record<string, string | string[]>,
): Promise<{ objetos: ObjetoCargado[]; masAntiguo?: string; degraded: boolean }> {
  const objetos: ObjetoCargado[] = [];
  let masAntiguo: string | undefined;
  let degraded = false;

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
        unresolvedObject: error instanceof Error ? error.message : String(error),
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
      objetos.push({ item, readStatus: 'generating', problems: [] });
      continue;
    }

    const columnas = lectura.result.columns.map((c) => c.name);
    const problems = validateBinding(instance, contrato, columnas);

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
  /**
   * Personalizacion de esta persona para este modulo, si la hay (4.6).
   *
   * Se pasa como DATO en vez de leerla aqui, y es deliberado: no todos los caminos deben
   * aplicarla. Una alerta se evalua sobre la definicion institucional —si no, ocultar un objeto
   * apagaria en silencio la alerta que vigila su medida—, y el vocabulario de la consulta en
   * lenguaje natural tampoco debe encogerse porque alguien escondiera un grafico.
   */
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
  const datasets = new Set(
    module.pages.flatMap((p) => p.items.map((i) => i.instance.binding.datasetId)),
  );

  for (const datasetId of datasets) {
    const lectura = await datasetReader.read({ datasetId, scope: resolucion.scope });
    // El TIPO viaja entero, no solo el nombre: el panel de filtros valida por tipo, y hasta
    // ahora se descartaba aqui mismo.
    if (lectura.result) columnsByDataset[datasetId] = lectura.result.columns;
  }

  return validateModule({ module, registry: objectRegistry, columnsByDataset });
}

/**
 * Diagnosticos para el EDITOR, sin ambito de por medio.
 *
 * El de arriba necesita un `userId` y un `teamId` porque valida contra las columnas que salieron
 * de una lectura ya filtrada. Un borrador recien creado todavia no cuelga de ninguna carpeta de
 * la organizacion general, asi que no tiene ambito que resolver y esa version devolveria null: el
 * editor no podria decir nada sobre el modulo que se esta escribiendo.
 *
 * Aqui las columnas disponibles salen de dos sitios que no dependen de quien mira:
 *
 *  - el REGISTRO de datasets, que declara que dimensiones y medidas trae cada uno (6.6), y
 *  - el `SchemaDescriptor` que el job dejo en el cache, que dice cuales siguen existiendo.
 *
 * Se INTERSECAN. Solo el registro pasaria por bueno un campo que la fuente ya retiro —que es
 * justo lo que 4.2 manda marcar roto—, y solo el esquema daria por disponible en un dataset
 * cualquier campo del modelo, incluidos los que ese dataset no trae.
 *
 * Ninguno de los dos invoca al conector: el principio 2 vale tambien dentro del editor, que es
 * donde seria mas tentador saltarselo para "comprobar de verdad" que un campo existe.
 */
export async function diagnosticarDefinicion(module: ModuleDefinition) {
  const columnsByDataset: Record<string, ColumnaDisponible[]> = {};

  const datasets = new Set(
    module.pages.flatMap((p) => p.items.map((i) => i.instance.binding.datasetId)),
  );

  for (const datasetId of datasets) {
    columnsByDataset[datasetId] = await columnasDisponiblesDe(datasetId);
  }

  return validateModule({ module, registry: objectRegistry, columnsByDataset });
}

/**
 * Columnas que un dataset ofrece HOY: lo que declara el registro y el esquema sigue reconociendo.
 *
 * La interseccion es el punto. Solo el registro daria por bueno un campo que la fuente ya retiro
 * —lo que 4.2 manda marcar roto—; solo el esquema daria por disponible en un dataset cualquier
 * campo del modelo, incluidos los que ese dataset no trae.
 *
 * Sin esquema en el cache se devuelve lo declarado: es el estado de un despliegue en el que el
 * job aun no ha corrido, y cortar ahi dejaria el editor inservible hasta la primera poblacion.
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

/**
 * Vista previa de un BORRADOR, para el editor.
 *
 * Se separa de `cargarModulo` por una razon concreta: aquella comprueba que el EQUIPO tenga
 * concedido el modulo en el arbol, y un borrador no esta en el arbol —todavia no se ha publicado
 * ni concedido a nadie—. Con esa comprobacion, el editor no podria dibujar nunca lo que se esta
 * construyendo.
 *
 * Lo que NO se relaja es el ambito. La autorizacion para ver un borrador es «es tuyo», y la
 * comprueba `moduloVisiblePorSlug` antes de llegar aqui; el ambito de DATOS se sigue resolviendo
 * y aplicando igual, con el mismo `leerObjetos` que usa la vista real. Si se saltara, crear un
 * borrador seria la forma mas facil de ver datos fuera del alcance propio, y ninguna prueba de la
 * vista normal lo detectaria.
 *
 * `scopeFor` se resuelve contra el modulo por su id aunque no este en el arbol: sin carpeta que
 * lo contenga, lo que queda es el ambito general del equipo, que es el mas restrictivo aplicable.
 */
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
   *
   * Lo que corresponde aqui es la primera capa de la resolucion: el ambito general del equipo
   * activo. No es una ampliacion —es el ambito propio del equipo de quien edita, el que se aplica
   * a todo lo que ese equipo ve—, y publicar el modulo en cualquier carpeta solo puede
   * restringirlo mas. Asi que la vista previa muestra COMO MUCHO lo que se vera publicado.
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
