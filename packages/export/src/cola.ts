import type { CacheEntry, ICacheStore } from '@app/caching';
import { claveDeTrabajo } from './types';
import type { ExportJob, ExportRequest } from './types';

/**
 * Cola de exportaciones — seccion 5.3.
 *
 *   "Cualquier operacion de larga duracion (exportacion de un reporte grande, por ejemplo) se
 *    despacha a una cola (Azure Queue Storage o Service Bus) y se procesa fuera del ciclo de
 *    solicitud HTTP, con estado de progreso consultable."
 *
 * `IExportQueue` es el puerto; `StoreExportQueue` es el adaptador de desarrollo, apoyado en el
 * mismo `ICacheStore` que ya comparten el shell y el job de poblacion. El adaptador de Azure
 * Queue Storage implementa esta misma interfaz y se sustituye en el cableado, igual que ocurre
 * con `ICacheStore` e `IDataConnector`.
 *
 * Limite conocido del adaptador de desarrollo: `ICacheStore` no ofrece operacion atomica de
 * lectura-modificacion-escritura, asi que el indice de pendientes admite carreras si hubiera
 * varios trabajadores a la vez. En desarrollo hay uno solo. En Azure no aplica: la exclusion la
 * da la propia cola con su tiempo de invisibilidad, que es justamente por lo que ahi se usa una
 * cola de verdad y no un indice en el store.
 */

export const CLAVE_COLA = 'export:queue:pendientes';

/** Un trabajo terminado deja de ser interesante bastante rapido; el artefacto ocupa sitio. */
export const TTL_TRABAJO_MS = 60 * 60 * 1000;

export interface IExportQueue {
  encolar(request: ExportRequest, ahora?: Date): Promise<ExportJob>;
  consultar(id: string): Promise<ExportJob | null>;
  /** Saca el siguiente pendiente y lo marca 'procesando'. `null` si no hay nada que hacer. */
  tomarSiguiente(ahora?: Date): Promise<ExportJob | null>;
  completar(id: string, artifact: NonNullable<ExportJob['artifact']>, ahora?: Date): Promise<void>;
  fallar(id: string, error: string, ahora?: Date): Promise<void>;
  pendientes(): Promise<string[]>;
}

function entrada<T>(value: T, ahora: Date): CacheEntry<T> {
  return { value, generatedAt: ahora.toISOString() };
}

export interface StoreExportQueueOptions {
  store: ICacheStore;
  /** Inyectable para poder probar el paso del tiempo sin esperar. */
  now?: () => Date;
  /** Inyectable porque `crypto.randomUUID` hace irreproducible cualquier asercion sobre ids. */
  nextId?: () => string;
}

export class StoreExportQueue implements IExportQueue {
  private readonly store: ICacheStore;
  private readonly now: () => Date;
  private readonly nextId: () => string;

  constructor(options: StoreExportQueueOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.nextId = options.nextId ?? (() => crypto.randomUUID());
  }

  async encolar(request: ExportRequest, ahora = this.now()): Promise<ExportJob> {
    const job: ExportJob = {
      id: this.nextId(),
      request,
      status: 'encolada',
      createdAt: ahora.toISOString(),
    };

    await this.store.set(claveDeTrabajo(job.id), entrada(job, ahora));
    const cola = await this.pendientes();
    await this.store.set(CLAVE_COLA, entrada([...cola, job.id], ahora));
    return job;
  }

  async consultar(id: string): Promise<ExportJob | null> {
    const entry = await this.store.get<ExportJob>(claveDeTrabajo(id));
    return entry?.value ?? null;
  }

  async pendientes(): Promise<string[]> {
    const entry = await this.store.get<string[]>(CLAVE_COLA);
    return entry?.value ?? [];
  }

  async tomarSiguiente(ahora = this.now()): Promise<ExportJob | null> {
    const cola = await this.pendientes();
    if (cola.length === 0) return null;

    const [id, ...resto] = cola;
    await this.store.set(CLAVE_COLA, entrada(resto, ahora));
    if (!id) return null;

    const job = await this.consultar(id);
    // El trabajo pudo caducar en el store antes de que nadie lo tomara: se descarta el id
    // huerfano y se sigue, en vez de dejar la cola atascada en una entrada que ya no existe.
    if (!job) return this.tomarSiguiente(ahora);

    const enCurso: ExportJob = { ...job, status: 'procesando', startedAt: ahora.toISOString() };
    await this.store.set(claveDeTrabajo(id), entrada(enCurso, ahora));
    return enCurso;
  }

  async completar(
    id: string,
    artifact: NonNullable<ExportJob['artifact']>,
    ahora = this.now(),
  ): Promise<void> {
    const job = await this.consultar(id);
    if (!job) return;
    const listo: ExportJob = {
      ...job,
      status: 'lista',
      finishedAt: ahora.toISOString(),
      artifact,
    };
    await this.store.set(claveDeTrabajo(id), entrada(listo, ahora));
  }

  async fallar(id: string, error: string, ahora = this.now()): Promise<void> {
    const job = await this.consultar(id);
    if (!job) return;
    const fallido: ExportJob = {
      ...job,
      status: 'fallida',
      finishedAt: ahora.toISOString(),
      error,
    };
    await this.store.set(claveDeTrabajo(id), entrada(fallido, ahora));
  }
}
