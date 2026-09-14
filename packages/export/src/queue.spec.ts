import { InMemoryCacheStore } from '@app/caching';
import { beforeEach, describe, expect, it } from 'vitest';
import { KEY_QUEUE, StoreExportQueue } from './queue';
import { generarArtefacto, pendientesProcess, jobProcess } from './process';
import type { ResolverObjects } from './process';
import { jobKey } from './types';
import type { ExportJob, ExportRequest, ExportableObject } from './types';

/**
 * La cola es lo que hace que 4.9 cumpla 5.3: exportar no devuelve un archivo, encola un trabajo
 * y devuelve un identificador consultable. Lo que mas se vigila aqui es que el trabajo guarde la
 * PETICION y no las filas: el ambito se vuelve a resolver al procesar, no al encolar.
 */

const peticion = (parcial: Partial<ExportRequest> = {}): ExportRequest => ({
  moduleSlug: 'expedientes',
  moduleName: 'Expedientes',
  format: 'csv',
  requestedBy: 'ana',
  teamId: 'equipo-penal',
  provenance: { isPersonalized: false, label: 'Vista institucional oficial' },
  appliedFilters: {},
  ...parcial,
});

const objeto: ExportableObject = {
  title: 'Casos',
  result: {
    columns: [{ name: 'materia', type: 'string' }],
    rows: [['Penal']],
    source: 'mock',
    generatedAt: '2026-03-01T10:00:00.000Z',
  },
};

let store: InMemoryCacheStore;
let queue: StoreExportQueue;
let ids = 0;

beforeEach(() => {
  store = new InMemoryCacheStore({ ttlMs: 60_000 });
  ids = 0;
  queue = new StoreExportQueue({
    store,
    now: () => new Date('2026-03-01T12:00:00.000Z'),
    nextId: () => `job-${++ids}`,
  });
});

describe('StoreExportQueue', () => {
  it('encola con estado consultable y sin artefacto todavia', async () => {
    const job = await queue.encolar(peticion());

    expect(job.status).toBe('encolada');
    expect(job.artifact).toBeUndefined();
    expect(await queue.consultar(job.id)).toMatchObject({ id: 'job-1', status: 'encolada' });
    expect(await queue.pendientes()).toEqual(['job-1']);
  });

  it('guarda la peticion, nunca las filas: el ambito se resuelve al procesar', async () => {
    const job = await queue.encolar(peticion());
    const guardado = JSON.stringify(await queue.consultar(job.id));

    expect(guardado).toContain('equipo-penal');
    expect(guardado).not.toContain('Penal"]'); // ninguna fila de datos viaja en el trabajo
  });

  it('atiende en orden de llegada y marca el tomado como procesando', async () => {
    await queue.encolar(peticion({ moduleSlug: 'primero' }));
    await queue.encolar(peticion({ moduleSlug: 'segundo' }));

    const primero = await queue.tomarSiguiente();
    expect(primero?.request.moduleSlug).toBe('primero');
    expect(primero?.status).toBe('procesando');
    expect(primero?.startedAt).toBeDefined();
    expect(await queue.pendientes()).toEqual(['job-2']);

    expect((await queue.tomarSiguiente())?.request.moduleSlug).toBe('segundo');
    expect(await queue.tomarSiguiente()).toBeNull();
  });

  it('descarta un id huerfano en vez de atascarse en el', async () => {
    const huerfano = await queue.encolar(peticion({ moduleSlug: 'caducado' }));
    const vivo = await queue.encolar(peticion({ moduleSlug: 'vivo' }));
    await store.delete(jobKey(huerfano.id));

    expect((await queue.tomarSiguiente())?.id).toBe(vivo.id);
    expect(await queue.pendientes()).toEqual([]);
  });

  it('completar deja el artefacto disponible y el estado en lista', async () => {
    const job = await queue.encolar(peticion());
    await queue.tomarSiguiente();
    await queue.completar(job.id, {
      filename: 'x.csv',
      contentType: 'text/csv',
      contentBase64: 'YQ==',
      bytes: 1,
    });

    const ready = await queue.consultar(job.id);
    expect(ready?.status).toBe('lista');
    expect(ready?.artifact?.filename).toBe('x.csv');
    expect(ready?.finishedAt).toBeDefined();
  });

  it('fallar deja el motivo escrito, para no dejar consultando un estado que no avanza', async () => {
    const job = await queue.encolar(peticion());
    await queue.fallar(job.id, 'el dataset no esta poblado');

    expect(await queue.consultar(job.id)).toMatchObject({
      status: 'fallida',
      error: 'el dataset no esta poblado',
    });
  });

  it('completar o fallar un trabajo inexistente no revienta ni lo crea', async () => {
    await queue.fallar('no-existe', 'da igual');
    expect(await queue.consultar('no-existe')).toBeNull();
  });

  it('deja la cola en una clave propia, fuera del espacio de datos de negocio', async () => {
    await queue.encolar(peticion());
    expect(KEY_QUEUE.startsWith('export:')).toBe(true);
    expect(await store.get<string[]>(KEY_QUEUE)).not.toBeNull();
  });
});

describe('la cola con varios a la vez', () => {
  /**
   * Un store que tarda en escribir. Sin retardo la ventana entre leer la cola y escribirla es
   * tan corta que la prueba no llega a caer en ella, y pasaria con la carrera puesta.
   */
  function lenta(): StoreExportQueue {
    const almacen = new InMemoryCacheStore({ ttlMs: 60_000 });
    const escribir = almacen.set.bind(almacen);
    almacen.set = async (clave, entrada) => {
      await new Promise((listo) => setTimeout(listo, 3));
      return escribir(clave, entrada);
    };
    let n = 0;
    return new StoreExportQueue({
      store: almacen,
      now: () => new Date('2026-03-01T12:00:00.000Z'),
      nextId: () => `job-${++n}`,
    });
  }

  it('cinco exportaciones pedidas a la vez se encolan las cinco', async () => {
    // Sin turno, las cinco leen la misma cola vacia y la ultima en escribir deja UN id. Los
    // otros cuatro trabajos quedan escritos pero nadie los toma nunca: quien los pidio se queda
    // viendo «En cola…» para siempre, sondeando cada seis decimas hasta que cierre la pestana.
    const cola = lenta();
    const pedidos = await Promise.all(
      Array.from({ length: 5 }, () => cola.encolar(peticion())),
    );

    const pendientes = await cola.pendientes();
    expect(pendientes).toHaveLength(5);
    expect([...pendientes].sort()).toEqual([...pedidos.map((j) => j.id)].sort());
  });

  it('dos trabajadores a la vez NO se llevan el mismo trabajo', async () => {
    // Es el caso de varias instancias, que la seccion 9 exige: dos servidores con su trabajador
    // mirando la misma cola. Tomado dos veces, el archivo se genera dos veces y el que queda
    // escrito es el del que termine el ultimo.
    const cola = lenta();
    await cola.encolar(peticion());
    await cola.encolar(peticion());

    const tomados = await Promise.all([
      cola.tomarSiguiente(),
      cola.tomarSiguiente(),
      cola.tomarSiguiente(),
    ]);

    const ids = tomados.filter((j) => j !== null).map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(2);
    // Y el tercero se va con las manos vacias, que es lo correcto: no hay mas.
    expect(tomados.filter((j) => j === null)).toHaveLength(1);
    expect(await cola.pendientes()).toEqual([]);
  });

  it('encolar mientras un trabajador toma no pierde ni repite', async () => {
    const cola = lenta();
    await cola.encolar(peticion());

    const [tomado, nuevo] = await Promise.all([cola.tomarSiguiente(), cola.encolar(peticion())]);

    expect(tomado?.id).toBe('job-1');
    // El recien llegado sigue en la cola: tomar no puede borrar lo que no llego a leer.
    expect(await cola.pendientes()).toEqual([nuevo.id]);
  });

  it('mirar una cola vacia no escribe', async () => {
    // El trabajador la mira dos veces por segundo. Si mirar escribiera, seria una escritura a
    // disco cada 500 ms sin que nada hubiera pasado.
    const almacen = new InMemoryCacheStore({ ttlMs: 60_000 });
    const escribir = almacen.set.bind(almacen);
    let escrituras = 0;
    almacen.set = async (clave, entrada) => {
      escrituras += 1;
      return escribir(clave, entrada);
    };
    const cola = new StoreExportQueue({ store: almacen });

    await cola.tomarSiguiente();
    const primeras = escrituras;
    await cola.tomarSiguiente();
    await cola.tomarSiguiente();
    expect(escrituras).toBe(primeras);
  });
});

describe('generarArtefacto', () => {
  it('elige el tipo mime y la extension segun el formato pedido', async () => {
    const csv = await generarArtefacto(peticion(), [objeto], { ahora: new Date('2026-03-01') });
    expect(csv.filename).toBe('expedientes-2026-03-01.csv');
    expect(csv.contentType).toContain('text/csv');
    expect(Buffer.from(csv.contentBase64, 'base64').toString('utf8')).toContain('materia');

    const xlsx = await generarArtefacto(peticion({ format: 'xlsx' }), [objeto], {
      ahora: new Date('2026-03-01'),
    });
    expect(xlsx.filename).toBe('expedientes-2026-03-01.xlsx');
    expect(xlsx.bytes).toBeGreaterThan(0);
  });

  it('marca en el nombre del archivo que es una vista personalizada (4.6)', async () => {
    const artefacto = await generarArtefacto(
      peticion({ provenance: { isPersonalized: true, label: 'Vista personalizada de ana' } }),
      [objeto],
      { ahora: new Date('2026-03-01') },
    );
    expect(artefacto.filename).toBe('expedientes-2026-03-01-vista-personalizada.csv');
  });

  it('rechaza exportar cuando no hay ningun objeto con datos', async () => {
    await expect(generarArtefacto(peticion(), [])).rejects.toThrow(/ningun objeto/i);
  });
});

describe('jobProcess', () => {
  const resolver: ResolverObjects = async () => ({
    objetos: [objeto],
    generatedAt: '2026-03-01T10:00:00.000Z',
  });

  /** Toma el siguiente trabajo y falla la prueba si no hay ninguno, en vez de arrastrar nulos. */
  const siguiente = async (): Promise<ExportJob> => {
    const job = await queue.tomarSiguiente();
    expect(job).not.toBeNull();
    return job as ExportJob;
  };

  const contenidoDe = (job: ExportJob | null): string => {
    expect(job?.artifact).toBeDefined();
    return Buffer.from(job?.artifact?.contentBase64 ?? '', 'base64').toString('utf8');
  };

  it('recorre el ciclo completo: encolada, procesando, lista con artefacto', async () => {
    const encolado = await queue.encolar(peticion());
    const tomado = await siguiente();
    expect(tomado.status).toBe('procesando');

    await jobProcess(tomado, queue, resolver);

    const ready = await queue.consultar(encolado.id);
    expect(ready?.status).toBe('lista');
    expect(contenidoDe(ready)).toContain('Penal');
  });

  it('incorpora la marca de tiempo del dato que devuelve el resolutor (4.8)', async () => {
    await queue.encolar(peticion());
    const tomado = await siguiente();
    await jobProcess(tomado, queue, resolver);

    expect(contenidoDe(await queue.consultar(tomado.id))).toContain('Datos actualizados');
  });

  it('escribe los filtros que el resolutor dice que se aplicaron, no los que se pidieron', async () => {
    // Se pide el Este; el ambito solo permite el Norte. El archivo tiene que decir la verdad
    // sobre lo que contiene, o "cero filas" se leera como "no hay casos en el Este".
    await queue.encolar(peticion({ appliedFilters: { distrito: ['Este'] } }));
    const tomado = await siguiente();

    await jobProcess(tomado, queue, async () => ({
      objetos: [objeto],
      appliedFilters: { distrito: ['Norte'] },
      outOfScopeFilters: ['distrito'],
    }));

    const contenido = contenidoDe(await queue.consultar(tomado.id));
    expect(contenido).toContain('distrito = Norte');
    expect(contenido).not.toContain('distrito = Este');
    expect(contenido).toContain('fuera de su ambito de acceso');
  });

  it('un fallo del resolutor se guarda en el trabajo, no se propaga', async () => {
    await queue.encolar(peticion());
    const tomado = await siguiente();

    await expect(
      jobProcess(tomado, queue, async () => {
        throw new Error('el modulo ya no existe');
      }),
    ).resolves.toBeUndefined();

    expect(await queue.consultar(tomado.id)).toMatchObject({
      status: 'fallida',
      error: 'el modulo ya no existe',
    });
  });

  it('pendientesProcess vacia la cola y respeta el maximo por vuelta', async () => {
    for (let i = 0; i < 5; i += 1) await queue.encolar(peticion());

    expect(await pendientesProcess(queue, resolver, { maximo: 2 })).toBe(2);
    expect(await queue.pendientes()).toHaveLength(3);
    expect(await pendientesProcess(queue, resolver)).toBe(3);
    expect(await queue.pendientes()).toHaveLength(0);
  });
});
