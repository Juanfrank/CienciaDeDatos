import type { ThemeTokens } from '@app/design-tokens';
import { aExcel, aPdf } from './binarios';
import { buildDocument } from './document';
import { aCsv, aSvg } from './formats';
import type { IExportQueue } from './queue';
import { TIPOS_MIME, nombreDeArchivo } from './types';
import type { ExportJob, ExportRequest, ExportableObject } from './types';

/** Procesamiento de un trabajo de exportacion. */

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

export interface GenerarOptions {
  /** Tema con el que se dibuja. Por defecto, el institucional (4.3). */
  theme?: ThemeTokens;
  ahora?: Date;
}

export async function generarArtefacto(
  request: ExportRequest,
  objetos: ExportableObject[],
  options: GenerarOptions = {},
): Promise<ArtefactoGenerado> {
  const ahora = options.ahora ?? new Date();

  if (objetos.length === 0) {
    throw new Error('No hay ningun objeto con datos que exportar.');
  }

  // El documento se construye UNA vez y los cuatro formatos parten de el. Ninguno decide que
  // objetos entran ni cual se dibuja como grafico: eso ya esta resuelto aqui arriba.
  const document = buildDocument(objetos, request, options.theme);

  let contenido: Buffer;
  switch (request.format) {
    case 'csv':
      contenido = Buffer.from(aCsv(document), 'utf8');
      break;
    case 'xlsx':
      contenido = await aExcel(document);
      break;
    case 'pdf':
      contenido = await aPdf(document);
      break;
    case 'svg':
      // Un SVG es UNA imagen. `documento.grafico` ya eligio cual: el primer objeto marcado como
      // grafico, no el primero a secas.
      contenido = Buffer.from(aSvg(document), 'utf8');
      break;
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
  queue: IExportQueue,
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
    await queue.completar(job.id, artefacto, options.ahora);
  } catch (error) {
    await queue.fallar(job.id, error instanceof Error ? error.message : String(error), options.ahora);
  }
}

/** Vacia la cola. Devuelve cuantos trabajos proceso. */
export async function procesarPendientes(
  queue: IExportQueue,
  resolver: ResolverObjetos,
  options: GenerarOptions & { maximo?: number } = {},
): Promise<number> {
  const maximo = options.maximo ?? 25;
  let procesados = 0;

  while (procesados < maximo) {
    const job = await queue.tomarSiguiente(options.ahora);
    if (!job) break;
    await procesarTrabajo(job, queue, resolver, options);
    procesados += 1;
  }

  return procesados;
}
