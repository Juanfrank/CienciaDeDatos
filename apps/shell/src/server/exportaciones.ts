import {
  StoreExportQueue,
  type ExportRequest,
  type ExportableObject,
  type ResolverObjetos,
} from '@app/export';
import { describeProvenance } from '@app/module-model';
import { proyectarObjeto } from '@app/ui-components';
import { cacheL2, objectRegistry } from './contexto';
import { cargarModulo } from './datos';
import { moduloVisibleParaUsuario } from './cicloDeVida';

/**
 * Cableado de la exportacion en el shell (4.9 con la restriccion de 5.3).
 *
 * La cola se apoya en el mismo store en disco que comparten el shell y el job: asi el trabajo
 * encolado por una instancia lo puede procesar otra, que es la situacion normal en App Service
 * con escalado horizontal. En Azure este mismo puerto se cablea a Azure Queue Storage.
 *
 * El resolutor es la pieza que importa para la seguridad. Llama a `cargarModulo` con el usuario
 * y el equipo QUE PIDIERON la exportacion, asi que el archivo sale filtrado por el ambito
 * efectivo de esa persona, resuelto EN EL MOMENTO DE GENERARLO — no en el de encolar. Y
 * `cargarModulo` lee del cache, nunca del conector (principio 2): exportar no abre un camino de
 * lectura paralelo.
 */

export const colaExportaciones = new StoreExportQueue({ store: cacheL2 });

/** Un segmentador es un control de filtrado, no contenido. Exportarlo seria ruido. */
const ES_CONTROL = new Set(['segmentador']);

/** Categorias del catalogo que merecen dibujarse como imagen al exportar en SVG. */
const CATEGORIAS_DE_GRAFICO = new Set(['grafico', 'mapa']);

export const resolverObjetos: ResolverObjetos = async (request: ExportRequest) => {
  const module = await moduloVisibleParaUsuario(request.moduleSlug, request.requestedBy);
  if (!module) throw new Error(`El modulo '${request.moduleSlug}' ya no existe.`);

  const cargado = await cargarModulo({
    module,
    ...(request.pageSlug ? { pageSlug: request.pageSlug } : {}),
    userId: request.requestedBy,
    teamId: request.teamId,
    requestedFilters: request.appliedFilters,
  });

  // `cargarModulo` devuelve null tanto si la pagina no existe como si el equipo no tiene
  // concedido el modulo. Se responde igual en los dos casos, sin revelar cual (4.11).
  if (!cargado) throw new Error('El modulo no esta disponible para este equipo.');

  // Un objeto sin resultado (todavia generandose) o marcado como roto no se exporta: un archivo
  // con una tabla vacia y sin explicacion es peor que un archivo sin esa tabla.
  //
  // Lo que se exporta de cada objeto es su PROYECCION, la misma que dibuja en pantalla. Volcar
  // el dataset en crudo hacia que un modulo con cinco objetos sobre un mismo dataset produjera
  // cinco veces la misma tabla, y que una tarjeta KPI —que muestra un numero— exportara las
  // filas completas.
  const objetos: ExportableObject[] = cargado.objetos.flatMap((o) => {
    const { instance } = o.item;
    if (!o.result || ES_CONTROL.has(instance.objectId) || o.problems.length > 0) return [];

    const categoria = objectRegistry.get(instance.objectId)?.category;
    return [
      {
        title: instance.title ?? instance.objectId,
        result: proyectarObjeto(instance, o.result),
        esGrafico: categoria !== undefined && CATEGORIAS_DE_GRAFICO.has(categoria),
      },
    ];
  });

  // `cargado.appliedFilters` son los pedidos YA intersecados con el ambito. Una dimension que
  // queda en lista vacia es un filtro que se pidio y el ambito descarto entero; se anota, para
  // que quien reciba el archivo no lea "cero filas" como "no hay casos".
  const aplicados: Record<string, string[]> = {};
  const descartados: string[] = [];
  for (const [campo, valores] of Object.entries(cargado.appliedFilters)) {
    if (valores.length > 0) aplicados[campo] = valores;
    else if (campo in request.appliedFilters) descartados.push(campo);
  }

  return {
    objetos,
    appliedFilters: aplicados,
    ...(descartados.length > 0 ? { outOfScopeFilters: descartados } : {}),
    ...(cargado.generatedAt ? { generatedAt: cargado.generatedAt } : {}),
  };
};

export interface EncolarInput {
  moduleSlug: string;
  pageSlug?: string;
  format: ExportRequest['format'];
  userId: string;
  teamId: string;
  appliedFilters: Record<string, string[]>;
  isPersonalized: boolean;
}

export async function encolarExportacion(input: EncolarInput) {
  const module = await moduloVisibleParaUsuario(input.moduleSlug, input.userId);
  if (!module) return null;

  const request: ExportRequest = {
    moduleSlug: module.slug,
    moduleName: module.name,
    ...(input.pageSlug ? { pageSlug: input.pageSlug } : {}),
    format: input.format,
    requestedBy: input.userId,
    teamId: input.teamId,
    provenance: describeProvenance(input.isPersonalized),
    appliedFilters: input.appliedFilters,
  };

  return colaExportaciones.encolar(request);
}
