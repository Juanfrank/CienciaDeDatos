import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockDataConnector, createDataConnector } from '@app/data-contracts-server';
import {
  CachedDatasetReader,
  FileCacheStore,
  InMemoryCacheStore,
  SCHEMA_CACHE_KEY,
  type DatasetRegistry,
  buildCacheKey,
} from '@app/caching';
import { gobiernoFixtures, resolveEffectiveScope } from '@app/access-control';
import { POPULATOR_HEARTBEAT_KEY, type GovernedQueryLog, buildHealthReport } from '@app/observability';
import { populate, refreshSchema, repopulateTargeted } from './populate';
import { runScheduledCycle } from './runCycle';

const { generalTree, esteTeam, norteTeam, anaUser, betoUser } = gobiernoFixtures;

const registry: DatasetRegistry = {
  datasets: [
    {
      datasetId: 'casos',
      description: 'fixture',
      query: {
        measures: ['CasosPendientes'],
        dimensions: [
          { table: 'DimTribunal', field: 'Distrito' },
          { table: 'DimTribunal', field: 'Materia' },
        ],
      },
      grain: 'preagregado',
    grainRationale: 'Dataset de prueba: agrupado, con medidas aditivas.',
    recurrence: '0 */4 * * *',
      recurrenceRationale: 'fixture',
      securityBinding: 'none',
      securityBindingRationale: 'fixture',
      scopeDimensions: [
        { table: 'DimTribunal', field: 'Distrito' },
        { table: 'DimTribunal', field: 'Materia' },
      ],
      consumedByModules: ['casos-pendientes-norte', 'casos-pendientes-este'],
      owner: 'fixture',
      registeredAt: '2026-09-11',
    },
  ],
};

const casosKey = () => {
  const dataset = registry.datasets[0];
  if (!dataset) throw new Error('fixture inesperado');
  return buildCacheKey({
    datasetId: dataset.datasetId,
    dimensions: dataset.query.dimensions,
    filters: dataset.query.filters,
    securityBinding: dataset.securityBinding,
  });
};

describe('populate: la unica via que invoca al conector', () => {
  let cacheStore: InMemoryCacheStore;
  let logs: GovernedQueryLog[];

  beforeEach(() => {
    cacheStore = new InMemoryCacheStore({ ttlMs: 60_000 });
    logs = [];
  });

  it('consulta, escribe en el cache y deja el latido que /health lee', async () => {
    const { heartbeat } = await populate({
      connector: new MockDataConnector(),
      cacheStore,
      registry,
      connectorKind: 'mock',
      onQueryLog: (l) => logs.push(l),
    });

    expect(heartbeat.connector).toBe('mock');
    expect(heartbeat.connectorReachable).toBe(true);
    expect(heartbeat.datasets).toEqual([
      expect.objectContaining({ datasetId: 'casos', outcome: 'ok' }),
    ]);
    expect((await cacheStore.get(casosKey()))?.value).toBeDefined();
    expect((await cacheStore.get(POPULATOR_HEARTBEAT_KEY))?.value).toBeDefined();
  });

  it('cada consulta queda trazada como originada en el job (principio 2)', async () => {
    await populate({
      connector: new MockDataConnector(),
      cacheStore,
      registry,
      connectorKind: 'mock',
      onQueryLog: (l) => logs.push(l),
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      kind: 'governed-query',
      connector: 'mock',
      datasetId: 'casos',
      outcome: 'ok',
      invokedBy: 'cache-populator',
    });
  });

  it('ante fallo de la fuente CONSERVA la ultima version valida', async () => {
    // Primer ciclo correcto.
    await populate({ connector: new MockDataConnector(), cacheStore, registry, connectorKind: 'mock' });
    const original = await cacheStore.get(casosKey());
    expect(original?.value).toBeDefined();

    // Segundo ciclo: la fuente falla.
    const roto = new MockDataConnector();
    roto.query = async () => {
      throw new Error('la fuente no responde');
    };

    const { heartbeat } = await populate({
      connector: roto,
      cacheStore,
      registry,
      connectorKind: 'mock',
      onQueryLog: (l) => logs.push(l),
    });

    expect(heartbeat.datasets[0]).toMatchObject({ outcome: 'fallo', error: 'la fuente no responde' });
    // El dato anterior sigue ahi: la persona lo ve con su fecha, en vez de un error.
    expect(await cacheStore.get(casosKey())).toEqual(original);
    expect(logs.at(-1)?.outcome).toBe('fallo');
  });

  it('conserva lastFullSuccessAt del ciclo anterior cuando el actual falla', async () => {
    const bueno = await populate({ connector: new MockDataConnector(), cacheStore, registry, connectorKind: 'mock' });
    const roto = new MockDataConnector();
    roto.query = async () => {
      throw new Error('caida');
    };
    const malo = await populate({
      connector: roto,
      cacheStore,
      registry,
      connectorKind: 'mock',
      previousHeartbeat: bueno.heartbeat,
    });
    expect(malo.heartbeat.lastFullSuccessAt).toBe(bueno.heartbeat.lastFullSuccessAt);
  });

  it('reporta la conectividad observada, aunque el conector no este implementado', async () => {
    const { heartbeat } = await populate({
      connector: createDataConnector({ kind: 'sql', sql: { server: 's', database: 'd' } }),
      cacheStore,
      registry,
      connectorKind: 'sql',
    });
    expect(heartbeat.connectorReachable).toBe(false);
    expect(heartbeat.datasets[0]?.outcome).toBe('fallo');
    expect(heartbeat.datasets[0]?.error).toMatch(/todavia no esta implementado/);
  });

  it('salta los datasets cuya recurrencia aun no se cumple', async () => {
    const { skipped } = await populate({
      connector: new MockDataConnector(),
      cacheStore,
      registry,
      connectorKind: 'mock',
      isDue: () => false,
    });
    expect(skipped).toEqual(['casos']);
  });

  it('saltar un dataset NO le borra su ultima ejecucion con exito', async () => {
    /*
     * La recurrencia se decide con «cuando corrio bien por ultima vez», y eso sale del latido.
     * El latido solo listaba los datasets que se poblaron EN ESA VUELTA, asi que un dataset
     * saltado desaparecia del latido y en la vuelta siguiente parecia no haber corrido nunca:
     * se volvia a poblar de inmediato. Una recurrencia de cada cuatro horas acababa consultando
     * la fuente cada dos vueltas, que es justo lo que la recurrencia existe para decidir (6.4).
     */
    const reloj = { ahora: new Date('2026-09-11T08:00:00.000Z') };
    const comun = {
      connector: new MockDataConnector(),
      cacheStore,
      registry,
      connectorKind: 'mock' as const,
      now: () => reloj.ahora,
    };

    // Primera vuelta: se puebla.
    const primera = await populate({ ...comun, isDue: () => true });
    expect(primera.skipped).toEqual([]);

    // Segunda: todavia no toca, se salta.
    reloj.ahora = new Date('2026-09-11T09:00:00.000Z');
    const segunda = await populate({
      ...comun,
      previousHeartbeat: primera.heartbeat,
      isDue: (_d, lastRunAt) => lastRunAt === undefined,
    });
    expect(segunda.skipped).toEqual(['casos']);

    /*
     * Tercera: la clave. `isDue` solo dice que si cuando NO consta ninguna ejecucion anterior,
     * asi que si el latido de la segunda vuelta perdio la fecha, este se puebla — y eso es
     * exactamente el fallo.
     */
    reloj.ahora = new Date('2026-09-11T10:00:00.000Z');
    const tercera = await populate({
      ...comun,
      previousHeartbeat: segunda.heartbeat,
      isDue: (_d, lastRunAt) => lastRunAt === undefined,
    });
    expect(tercera.skipped).toEqual(['casos']);
  });
});

describe('repopulateTargeted: invalidacion dirigida (6.5)', () => {
  it('invalida solo el dataset afectado y lo vuelve a poblar', async () => {
    const cacheStore = new InMemoryCacheStore({ ttlMs: 60_000 });
    await cacheStore.set('ds:otro:abc', { value: { intacto: true }, generatedAt: '2026-01-01' });
    await populate({ connector: new MockDataConnector(), cacheStore, registry, connectorKind: 'mock' });

    await repopulateTargeted(['casos'], {
      connector: new MockDataConnector(),
      cacheStore,
      registry,
      connectorKind: 'mock',
    });

    expect((await cacheStore.get(casosKey()))?.value).toBeDefined();
    // Un dataset ajeno no se toca: no se vacia todo el cache.
    expect((await cacheStore.get('ds:otro:abc'))?.value).toEqual({ intacto: true });
  });
});

describe('refreshSchema (6.4)', () => {
  it('cachea el esquema para que el editor no consulte la fuente en cada validacion', async () => {
    const cacheStore = new InMemoryCacheStore({ ttlMs: 60_000 });
    const schema = await refreshSchema({ connector: new MockDataConnector(), cacheStore });
    expect(schema?.tables.length).toBeGreaterThan(0);
    expect((await cacheStore.get(SCHEMA_CACHE_KEY))?.value).toEqual(schema);
  });

  it('si la fuente falla, conserva el esquema anterior antes que dejar al editor sin nada', async () => {
    const cacheStore = new InMemoryCacheStore({ ttlMs: 60_000 });
    await refreshSchema({ connector: new MockDataConnector(), cacheStore });
    const previo = await cacheStore.get(SCHEMA_CACHE_KEY);

    const roto = new MockDataConnector();
    roto.getSchema = async () => {
      throw new Error('sin esquema');
    };
    expect(await refreshSchema({ connector: roto, cacheStore })).toBeNull();
    expect(await cacheStore.get(SCHEMA_CACHE_KEY)).toEqual(previo);
  });
});

describe('runScheduledCycle', () => {
  it('refresca el esquema en el primer ciclo y lo anota en el latido', async () => {
    const cacheStore = new InMemoryCacheStore({ ttlMs: 60_000 });
    const r = await runScheduledCycle({
      connector: new MockDataConnector(),
      cacheStore,
      registry,
      connectorKind: 'mock',
    });
    expect(r.schemaRefreshed).toBe(true);
    expect(r.heartbeat.schemaRefreshedAt).toBeDefined();
  });

  it('no refresca el esquema si no ha pasado su intervalo', async () => {
    const cacheStore = new InMemoryCacheStore({ ttlMs: 60_000 });
    await runScheduledCycle({ connector: new MockDataConnector(), cacheStore, registry, connectorKind: 'mock' });
    const second = await runScheduledCycle({
      connector: new MockDataConnector(),
      cacheStore,
      registry,
      connectorKind: 'mock',
    });
    expect(second.schemaRefreshed).toBe(false);
  });
});

describe('de punta a punta: poblar, leer y filtrar por ambito', () => {
  let directorio: string;
  let l2: FileCacheStore;

  beforeEach(async () => {
    directorio = await mkdtemp(join(tmpdir(), 'cache-'));
    l2 = new FileCacheStore({ directory: directorio });
  });

  afterEach(async () => {
    await rm(directorio, { recursive: true, force: true });
  });

  const readAs = async (user: typeof anaUser, team: typeof norteTeam, moduleId: string) => {
    const reader = new CachedDatasetReader({
      l1: new InMemoryCacheStore({ ttlMs: 1000 }),
      l2,
      registry,
    });
    const { scope } = resolveEffectiveScope({ user, activeTeam: team, moduleId, generalTree: generalTree });
    return reader.read({ datasetId: 'casos', scope });
  };

  it('el cache escrito por el job es legible por el camino de lectura, en otro proceso', async () => {
    // FileCacheStore existe justamente por esto: job y servidor son procesos distintos.
    await populate({ connector: new MockDataConnector(), cacheStore: l2, registry, connectorKind: 'mock' });
    const r = await readAs(anaUser, norteTeam, 'casos-pendientes-norte');
    expect(r.status).toBe('ok');
    expect(r.result?.rows.length).toBeGreaterThan(0);
  });

  it('una sola escritura del job satisface a DOS equipos con ambitos distintos', async () => {
    await populate({ connector: new MockDataConnector(), cacheStore: l2, registry, connectorKind: 'mock' });

    const norte = await readAs(anaUser, norteTeam, 'casos-pendientes-norte');
    const este = await readAs(betoUser, esteTeam, 'casos-pendientes-este');

    // Una unica entrada de dataset en el cache (mas el latido).
    const keys = (await l2.keys()).filter((k) => k.startsWith('ds:'));
    expect(keys).toHaveLength(1);

    // Y cada equipo ve su subconjunto, distinto y correcto.
    const distritosDe = (r: typeof norte) =>
      [...new Set((r.result?.rows ?? []).map((fila) => String(fila[0])))];
    expect(distritosDe(norte)).toEqual(['Distrito Norte']);
    expect(distritosDe(este)).toEqual(['Distrito Este']);
  });

  it('sin poblar, el camino de lectura dice "generandose" y nunca consulta la fuente', async () => {
    const r = await readAs(anaUser, norteTeam, 'casos-pendientes-norte');
    expect(r.status).toBe('generating');
  });

  it('/health reporta el conector leyendo el latido, sin instanciar ninguno', async () => {
    await populate({ connector: new MockDataConnector(), cacheStore: l2, registry, connectorKind: 'mock' });
    const latido = (await l2.get<Parameters<typeof buildHealthReport>[0]['heartbeat']>(POPULATOR_HEARTBEAT_KEY))?.value;

    const informe = buildHealthReport({
      configuredConnector: 'mock',
      cacheStoreReachable: true,
      identityDbReachable: true,
      heartbeat: latido ?? null,
    });

    expect(informe.status).toBe('ok');
    expect(informe.checks.find((c) => c.name === 'conector-de-datos')?.detail).toContain("'mock'");
  });
});
