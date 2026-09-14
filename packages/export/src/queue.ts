import { mutate } from '@app/caching';
import type { CacheEntry, ICacheStore } from '@app/caching';
import { jobKey } from './types';
import type { ExportJob, ExportRequest } from './types';

/** Cola de exportaciones — seccion 5.3. */

export const KEY_QUEUE = 'export:queue:pendientes';

/** Un trabajo terminado deja de ser interesante bastante rapido; el artefacto ocupa sitio. */
export const TTL_JOB_MS = 60 * 60 * 1000;

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

    await this.store.set(jobKey(job.id), entrada(job, ahora));
    // La cola se toca bajo turno. Leerla y escribirla como dos pasos hacia que dos exportaciones
    // pedidas a la vez leyeran la misma cola y la segunda borrara el id de la primera: el
    // trabajo quedaba escrito pero nadie lo tomaba nunca, y quien lo pidio se quedaba viendo
    // «En cola…» para siempre.
    await mutate<string[]>(this.store, KEY_QUEUE, (cola) => [...(cola ?? []), job.id], { ahora });
    return job;
  }

  async consultar(id: string): Promise<ExportJob | null> {
    const entry = await this.store.get<ExportJob>(jobKey(id));
    return entry?.value ?? null;
  }

  async pendientes(): Promise<string[]> {
    const entry = await this.store.get<string[]>(KEY_QUEUE);
    return entry?.value ?? [];
  }

  /**
   * Saca el siguiente pendiente y lo marca 'procesando'.
   *
   * Sacar es UNA operacion, no dos. Leyendo la cola y escribiendo el resto por separado, dos
   * trabajadores —o el trabajador y una peticion que encola— leian la misma cabeza y los dos se
   * llevaban el mismo trabajo: la exportacion se generaba dos veces y la que quedaba escrita era
   * la que terminara la ultima.
   *
   * El id se saca dentro del turno; leer el trabajo y marcarlo se hace fuera, ya con el id en la
   * mano: nadie mas lo tiene, asi que no hay con quien competir por el.
   */
  async tomarSiguiente(ahora = this.now()): Promise<ExportJob | null> {
    for (;;) {
      let tomado: string | undefined;
      await mutate<string[]>(
        this.store,
        KEY_QUEUE,
        (cola) => {
          const [id, ...resto] = cola ?? [];
          tomado = id;
          // Sin nada que tomar se devuelve la MISMA cola: `mutate` no escribe lo que no cambia,
          // y el trabajador mira esto dos veces por segundo.
          return id === undefined ? (cola ?? []) : resto;
        },
        { ahora },
      );
      if (tomado === undefined) return null;

      const job = await this.consultar(tomado);
      // El trabajo pudo caducar en el store antes de que nadie lo tomara: se descarta el id
      // huerfano y se sigue, en vez de dejar la cola atascada en una entrada que ya no existe.
      // Se itera en vez de llamarse a si misma: la llamada recursiva volveria a pedir el mismo
      // turno que todavia no se ha soltado.
      if (!job) continue;

      const enCurso: ExportJob = { ...job, status: 'procesando', startedAt: ahora.toISOString() };
      await this.store.set(jobKey(tomado), entrada(enCurso, ahora));
      return enCurso;
    }
  }

  async completar(
    id: string,
    artifact: NonNullable<ExportJob['artifact']>,
    ahora = this.now(),
  ): Promise<void> {
    const job = await this.consultar(id);
    if (!job) return;
    const ready: ExportJob = {
      ...job,
      status: 'lista',
      finishedAt: ahora.toISOString(),
      artifact,
    };
    await this.store.set(jobKey(id), entrada(ready, ahora));
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
    await this.store.set(jobKey(id), entrada(fallido, ahora));
  }
}
