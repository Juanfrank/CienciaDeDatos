import type { QueryResult } from '@app/data-contracts';
import { canTeamAccessModule, intersectRequestedFilters, type AccessScope } from '@app/access-control';
import type { ReadResult } from '@app/caching';
import { type GridItem, type ModuleDefinition, findPage, validateModule } from '@app/module-model';
import { type BindingProblem, fieldKey, validateBinding } from '@app/ui-components';
import { datasetReader, findTeam, getGeneralTree, objectRegistry, scopeFor } from './contexto';

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
}

/** Filtros sin los que corresponden a las dimensiones propias del objeto. */
function sinFiltroPropio(
  filtros: Record<string, string | string[]>,
  propias: { table: string; field: string }[],
): Record<string, string | string[]> {
  const claves = new Set(propias.map(fieldKey));
  return Object.fromEntries(Object.entries(filtros).filter(([clave]) => !claves.has(clave)));
}

export async function cargarModulo(input: {
  module: ModuleDefinition;
  pageSlug?: string;
  userId: string;
  teamId: string;
  /** Filtros pedidos por la query string, ya parseados (4.11). */
  requestedFilters: Record<string, string | string[]>;
}): Promise<ModuloCargado | null> {
  const { module, userId, teamId, requestedFilters } = input;

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
  const team = findTeam(teamId);
  if (!team || !canTeamAccessModule(getGeneralTree(), team, module.moduleId)) return null;

  const resolucion = scopeFor(userId, teamId, module.moduleId);
  // Sin ambito resoluble, el modulo no existe para esta persona. Resultado vacio y explicito,
  // nunca un error que revele que existe algo fuera de su alcance (4.11).
  const scope: AccessScope = resolucion?.scope ?? { restrictions: [{ dimension: { table: '', field: '' }, allowedValues: [] }] };

  const appliedFilters = intersectRequestedFilters(scope, requestedFilters);
  const objetos: ObjetoCargado[] = [];
  let masAntiguo: string | undefined;
  let degraded = false;

  for (const item of page.items) {
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

  return {
    module,
    pageSlug: page.slug,
    objetos,
    appliedFilters,
    ...(masAntiguo ? { generatedAt: masAntiguo } : {}),
    degraded,
  };
}

/** Diagnosticos del modulo para el editor, con las columnas realmente presentes en el cache. */
export async function diagnosticarModulo(module: ModuleDefinition, userId: string, teamId: string) {
  const resolucion = scopeFor(userId, teamId, module.moduleId);
  if (!resolucion) return null;

  const columnsByDataset: Record<string, string[]> = {};
  const datasets = new Set(
    module.pages.flatMap((p) => p.items.map((i) => i.instance.binding.datasetId)),
  );

  for (const datasetId of datasets) {
    const lectura = await datasetReader.read({ datasetId, scope: resolucion.scope });
    if (lectura.result) columnsByDataset[datasetId] = lectura.result.columns.map((c) => c.name);
  }

  return validateModule({ module, registry: objectRegistry, columnsByDataset });
}
