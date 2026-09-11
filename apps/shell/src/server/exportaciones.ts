import {
  StoreExportQueue,
  type ExportRequest,
  type ExportableObject,
  type ResolverObjetos,
} from '@app/export';
import { describeProvenance } from '@app/module-model';
import { cacheL2 } from './contexto';
import { cargarModulo } from './datos';
import { findModuleBySlug } from './modulos';

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

export const resolverObjetos: ResolverObjetos = async (request: ExportRequest) => {
  const module = findModuleBySlug(request.moduleSlug);
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
  const objetos: ExportableObject[] = cargado.objetos.flatMap((o) =>
    o.result && !ES_CONTROL.has(o.item.instance.objectId) && o.problems.length === 0
      ? [{ title: o.item.instance.title ?? o.item.instance.objectId, result: o.result }]
      : [],
  );

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
  const module = findModuleBySlug(input.moduleSlug);
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
