import { aExcel, aPdf } from './binarios';
import { aCsv, aSvg } from './formatos';
import type { IExportQueue } from './cola';
import { TIPOS_MIME, nombreDeArchivo } from './types';
import type { ExportJob, ExportRequest, ExportableObject } from './types';

/**
 * Procesamiento de un trabajo de exportacion.
 *
 * El trabajo guarda la PETICION, nunca las filas. Es deliberado y es de seguridad: el trabajador
 * vuelve a resolver el ambito de quien pidio la exportacion en el momento de generar el archivo,
 * asi que el contenido sale filtrado por el ambito vigente y por el equipo activo de esa persona.
 * Si el trabajo llevara los datos dentro, un cambio de permisos entre encolar y procesar —o
 * simplemente un trabajo leido por otro proceso— romperia el principio 5, el aislamiento por
 * seguridad. Ademas el resolutor lee del CACHE (principio 2): la exportacion no es una excepcion
 * al camino de lectura, es un consumidor mas.
 */

/** Resuelve los objetos a exportar para una peticion. Lo aporta quien cablea, que sabe leer. */
export type ResolverObjetos = (request: ExportRequest) => Promise<{
  objetos: ExportableObject[];
  generatedAt?: string;
  /** Los filtros REALMENTE aplicados, ya intersecados con el ambito de quien exporta. */
  appliedFilters?: Record<string, string[]>;
  /** Dimensiones cuyo filtro pedido quedaba fuera del ambito y no se aplico. */
  outOfScopeFilters?: string[];
}>;

export interface ArtefactoGenerado {
  filename: string;
  contentType: string;
  contentBase64: string;
  bytes: number;
}

/** Paleta para el SVG. La aporta quien cablea, desde los tokens del tema (4.7). */
export interface GenerarOptions {
  colores?: string[];
  ahora?: Date;
}

const COLORES_POR_DEFECTO = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed'];

export async function generarArtefacto(
  request: ExportRequest,
  objetos: ExportableObject[],
  options: GenerarOptions = {},
): Promise<ArtefactoGenerado> {
  const ahora = options.ahora ?? new Date();
  const colores = options.colores ?? COLORES_POR_DEFECTO;

  if (objetos.length === 0) {
    throw new Error('No hay ningun objeto con datos que exportar.');
  }

  let contenido: Buffer;
  switch (request.format) {
    case 'csv':
      contenido = Buffer.from(aCsv(objetos, request), 'utf8');
      break;
    case 'xlsx':
      contenido = await aExcel(objetos, request);
      break;
    case 'pdf':
      contenido = await aPdf(objetos, request);
      break;
    case 'svg': {
      // Un SVG es UN grafico. Si el modulo tiene varios, se exporta el primero: la alternativa
      // seria concatenar imagenes en un solo lienzo, que no es lo que nadie espera al pedir SVG.
      const primero = objetos[0];
      if (!primero) throw new Error('No hay ningun objeto con datos que exportar.');
      contenido = Buffer.from(aSvg(primero, request, colores), 'utf8');
      break;
    }
  }

  return {
    filename: nombreDeArchivo(request, ahora),
    contentType: TIPOS_MIME[request.format],
    contentBase64: contenido.toString('base64'),
    bytes: contenido.byteLength,
  };
}

/**
 * Procesa un trabajo ya tomado de la cola. Nunca lanza: un fallo se guarda EN el trabajo, para
 * que quien lo pidio pueda ver por que no salio, en vez de quedarse consultando un estado que
 * no avanza nunca.
 */
export async function procesarTrabajo(
  job: ExportJob,
  cola: IExportQueue,
  resolver: ResolverObjetos,
  options: GenerarOptions = {},
): Promise<void> {
  try {
    const resuelto = await resolver(job.request);
    const { objetos } = resuelto;

    // Lo que se escribe en el encabezado es lo que el resolutor dice que se aplico, no lo que
    // venia en la peticion. Es la unica forma de que el archivo no mienta sobre su contenido.
    const request: ExportRequest = {
      ...job.request,
      ...(resuelto.generatedAt ? { generatedAt: resuelto.generatedAt } : {}),
      ...(resuelto.appliedFilters ? { appliedFilters: resuelto.appliedFilters } : {}),
      ...(resuelto.outOfScopeFilters && resuelto.outOfScopeFilters.length > 0
        ? { outOfScopeFilters: resuelto.outOfScopeFilters }
        : {}),
    };
    const artefacto = await generarArtefacto(request, objetos, options);
    await cola.completar(job.id, artefacto, options.ahora);
  } catch (error) {
    await cola.fallar(job.id, error instanceof Error ? error.message : String(error), options.ahora);
  }
}

/** Vacia la cola. Devuelve cuantos trabajos proceso. */
export async function procesarPendientes(
  cola: IExportQueue,
  resolver: ResolverObjetos,
  options: GenerarOptions & { maximo?: number } = {},
): Promise<number> {
  const maximo = options.maximo ?? 25;
  let procesados = 0;

  while (procesados < maximo) {
    const job = await cola.tomarSiguiente(options.ahora);
    if (!job) break;
    await procesarTrabajo(job, cola, resolver, options);
    procesados += 1;
  }

  return procesados;
}
