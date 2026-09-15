import { mutate } from '@app/caching';
import type { CacheEntry, ICacheStore } from '@app/caching';
import { jobKey } from './types';
import type { ExportJob, ExportRequest } from './types';

/** Cola de exportaciones — seccion 5.3. */

export const KEY_QUEUE = 'export:queue:pendientes';

/**
 * Un trabajo terminado deja de ser interesante bastante rapido; el artefacto ocupa sitio.
 *
 * Esto lo APLICA `purgarCaducados`, que el trabajador de fondo llama cada tanto. Antes era una
 * constante exportada que no leia nadie: cada exportacion —un PDF o un Excel enteros, en base64
 * dentro de la entrada— se quedaba en el almacen para siempre. No es solo sitio: son datos
 * judiciales ya filtrados, guardados sin plazo, que es justo lo que un plazo existe para evitar.
 */
export const TTL_JOB_MS = 60 * 60 * 1000;

/** Indice de trabajos terminados, con la hora en que terminaron. El almacen es de clave-valor y
 *  no se puede recorrer, asi que el plazo necesita saber a quien mirar. */
export const KEY_TERMINADAS = 'export:queue:terminadas';

interface Terminada {
  id: string;
  at: string;
}

export interface IExportQueue {
  encolar(request: ExportRequest, ahora?: Date): Promise<ExportJob>;
  consultar(id: string): Promise<ExportJob | null>;
  /** Saca el siguiente pendiente y lo marca 'procesando'. `null` si no hay nada que hacer. */
  tomarSiguiente(ahora?: Date): Promise<ExportJob | null>;
  completar(id: string, artifact: NonNullable<ExportJob['artifact']>, ahora?: Date): Promise<void>;
  fallar(id: string, error: string, ahora?: Date): Promise<void>;
  pendientes(): Promise<string[]>;
  /** Borra los trabajos terminados que ya pasaron su plazo. Devuelve cuantos borro. */
  purgarCaducados(ahora?: Date): Promise<number>;
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
    await this.anotarTerminada(id, ahora);
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
    await this.anotarTerminada(id, ahora);
  }

  /** Apunta un trabajo en el indice de terminados, para que el plazo sepa a quien mirar. */
  private async anotarTerminada(id: string, ahora: Date): Promise<void> {
    await mutate<Terminada[]>(
      this.store,
      KEY_TERMINADAS,
      (previas) => [...(previas ?? []).filter((t) => t.id !== id), { id, at: ahora.toISOString() }],
      { ahora },
    );
  }

  /**
   * Borra los trabajos terminados que ya pasaron su plazo.
   *
   * El artefacto se borra CON el trabajo: guardar el trabajo sin su archivo dejaria a quien lo
   * consulta viendo «Lista» y un enlace que no descarga nada, que dice menos que «ya no esta
   * disponible». Quien consulta un trabajo purgado recibe eso ultimo, y el sondeo se para — el
   * camino ya estaba escrito y hasta ahora no lo recorria nadie.
   */
  async purgarCaducados(ahora = this.now()): Promise<number> {
    const limite = ahora.getTime() - TTL_JOB_MS;
    const vencida = (t: Terminada): boolean => {
      const cuando = new Date(t.at).getTime();
      // Una fecha ilegible se purga: dejarla seria una entrada que nunca vence.
      return !Number.isFinite(cuando) || cuando <= limite;
    };

    let caducadas: Terminada[] = [];
    await mutate<Terminada[]>(
      this.store,
      KEY_TERMINADAS,
      (previas) => {
        const todas = previas ?? [];
        caducadas = todas.filter(vencida);
        // Sin nada que purgar se devuelve la MISMA lista: esto corre cada pocos minutos y no
        // tiene por que escribir en disco para decir que no habia nada que hacer.
        return caducadas.length === 0 ? todas : todas.filter((t) => !vencida(t));
      },
      { ahora },
    );

    for (const t of caducadas) await this.store.delete(jobKey(t.id));
    return caducadas.length;
  }
}
