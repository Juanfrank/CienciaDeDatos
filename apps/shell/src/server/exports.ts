import type { QueryResult } from '@app/data-contracts';
import {
  StoreExportQueue,
  type ExportRequest,
  type ExportableObject,
  type ResolverObjetos,
} from '@app/export';
import { describeProvenance } from '@app/module-model';
import {
  describirRegla,
  measureFormatter,
  projectObject,
  type ObjectInstance,
} from '@app/ui-components';
import { cacheL2, objectRegistry } from './context';
import { cargarModulo } from './data';
import { moduloServibleParaUsuario } from './cicloDeVida';
import { readPersonalization } from './personalization';

/** Cableado de la exportacion en el shell (4.9 con la restriccion de 5.3). */

export const queueExports = new StoreExportQueue({ store: cacheL2 });

/** Un segmentador es un control de filtrado, no contenido. Exportarlo seria ruido. */
const ES_CONTROL = new Set(['segmentador']);

/** Categorias del catalogo que merecen dibujarse como imagen al exportar en SVG. */
const CHART_CATEGORIES = new Set(['grafico', 'mapa']);

export const resolverObjetos: ResolverObjetos = async (request: ExportRequest) => {
  const module = await moduloServibleParaUsuario(request.moduleSlug, request.requestedBy);
  if (!module) throw new Error(`El modulo '${request.moduleSlug}' ya no existe.`);

  const cargado = await cargarModulo({
    module,
    ...(request.pageSlug ? { pageSlug: request.pageSlug } : {}),
    // La exportacion sale de lo que la persona VE: si oculto un objeto, no aparece en el
    // archivo. Es lo que 4.6 quiere decir con que la distincion viaje al exportar — el archivo
    // refleja la vista personalizada y lo dice en el encabezado.
    personalization: await readPersonalization(request.requestedBy, module.moduleId),
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
    const projected = projectObject(instance, o.result, o.aggregations);
    const notas = notasDe(instance);
    return [
      {
        title: instance.title ?? instance.objectId,
        result: projected,
        textos: textsOf(instance, projected),
        ...(notas.length > 0 ? { notas } : {}),
        isChart: categoria !== undefined && CHART_CATEGORIES.has(categoria),
      },
    ];
  });

  // `cargado.appliedFilters` son los pedidos YA intersecados con el ambito. Una dimension que
  // queda en lista vacia es un filtro que se pidio y el ambito descarto entero; se anota, para
  // que quien reciba el archivo no lea "cero filas" como "no hay casos".
  const aplicados: Record<string, string[]> = {};
  const descartados: string[] = [];
  for (const [fieldName, valores] of Object.entries(cargado.appliedFilters)) {
    if (valores.length > 0) aplicados[fieldName] = valores;
    else if (fieldName in request.appliedFilters) descartados.push(fieldName);
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
}

export async function encolarExportacion(input: EncolarInput) {
  const module = await moduloServibleParaUsuario(input.moduleSlug, input.userId);
  if (!module) return null;

  const request: ExportRequest = {
    moduleSlug: module.slug,
    moduleName: module.name,
    ...(input.pageSlug ? { pageSlug: input.pageSlug } : {}),
    format: input.format,
    requestedBy: input.userId,
    teamId: input.teamId,
    // La procedencia la decide el SERVIDOR, mirando si esta persona tiene personalizacion de
    // este modulo. Venia en el cuerpo de la peticion, es decir, la elegia el navegador: bastaba
    // enviar `personalizada: false` para que un archivo salido de una vista personalizada se
    // presentara como la vista institucional oficial, que es justo lo que 4.6 impide.
    provenance: describeProvenance(
      (await readPersonalization(input.userId, module.moduleId)) !== undefined,
    ),
    appliedFilters: input.appliedFilters,
  };

  return queueExports.encolar(request);
}

/** Las mismas cifras, con el formato de la pantalla. */
function textsOf(instance: ObjectInstance, projected: QueryResult): string[][] {
  // Un formateador POR COLUMNA y no por celda: en una tabla larga son miles de llamadas, y el
  // formato depende de la medida, que es la columna.
  const porColumna = projected.columns.map((c) => measureFormatter(instance.presentacion, c.name));
  return projected.rows.map((fila) =>
    fila.map((cell, i) =>
      typeof cell === 'number' ? (porColumna[i] ?? String)(cell) : String(cell ?? ''),
    ),
  );
}

/** Lo que el objeto dice ademas de sus cifras. */
function notasDe(instance: ObjectInstance): string[] {
  const p = instance.presentacion;
  const notas: string[] = [];

  for (const line of p?.referencias ?? []) {
    const nombre = line.etiqueta ?? 'Referencia';
    notas.push(`${nombre}: ${line.valor}`);
  }
  for (const colorRule of p?.condicional?.rules ?? []) {
    const reach = colorRule.medida ? `${colorRule.medida} ` : '';
    notas.push(`Marcado en pantalla: ${reach}${describirRegla(colorRule)}`);
  }
  return notas;
}
