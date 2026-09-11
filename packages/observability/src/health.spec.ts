import { describe, expect, it } from 'vitest';
import { assertConfigChangeIsAuditable, assertQueryCameFromPopulator } from './auditEvents';
import { buildHealthReport } from './health';
import { summarizeHeartbeat, type PopulatorHeartbeat } from './heartbeat';

const AHORA = Date.UTC(2026, 8, 11, 12, 0, 0);
const now = () => AHORA;

const latido = (overrides: Partial<PopulatorHeartbeat> = {}): PopulatorHeartbeat => ({
  startedAt: new Date(AHORA - 120_000).toISOString(),
  finishedAt: new Date(AHORA - 60_000).toISOString(),
  connector: 'mock',
  connectorReachable: true,
  datasets: [{ datasetId: 'casos', outcome: 'ok', rowCount: 10, durationMs: 120 }],
  lastFullSuccessAt: new Date(AHORA - 60_000).toISOString(),
  ...overrides,
});

const base = {
  configuredConnector: 'mock',
  cacheStoreReachable: true,
  identityDbReachable: true,
  now,
};

const check = (r: { checks: { name: string; status: string; detail?: string }[] }, name: string) => {
  const encontrado = r.checks.find((c) => c.name === name);
  if (!encontrado) throw new Error(`falta la comprobacion ${name}`);
  return encontrado;
};

describe('buildHealthReport (seccion 7)', () => {
  it('reporta ok cuando todo responde', () => {
    const r = buildHealthReport({ ...base, heartbeat: latido() });
    expect(r.status).toBe('ok');
    expect(r.configuredConnector).toBe('mock');
  });

  it('reporta el conector activo SIN instanciar ninguno', () => {
    const r = buildHealthReport({ ...base, heartbeat: latido({ connector: 'sql' }) });
    // La conectividad viene del latido que dejo el job, no de un testConnection() del proceso web.
    expect(check(r, 'conector-de-datos').detail).toContain("'sql'");
  });

  describe('degradado frente a caido: importa para las sondas de App Service', () => {
    it('el Storage de cache caido es DEGRADADO, no caido', () => {
      // La aplicacion sigue sirviendo desde L1 el ultimo dato valido (6.9). Marcarlo como
      // caido haria que las sondas reiniciaran instancias sanas justo cuando mas hacen falta.
      const r = buildHealthReport({ ...base, cacheStoreReachable: false, heartbeat: latido() });
      expect(check(r, 'cache-l2').status).toBe('degradado');
      expect(r.status).toBe('degradado');
    });

    it('la base de identidad inalcanzable si es CAIDO', () => {
      // Sin ella no hay sesion ni resolucion de ambito: no se puede servir nada.
      const r = buildHealthReport({ ...base, identityDbReachable: false, heartbeat: latido() });
      expect(check(r, 'base-de-identidad').status).toBe('caido');
      expect(r.status).toBe('caido');
    });

    it('el conector inalcanzable es DEGRADADO: el cache sigue sirviendo', () => {
      const r = buildHealthReport({ ...base, heartbeat: latido({ connectorReachable: false }) });
      expect(check(r, 'conector-de-datos').status).toBe('degradado');
      expect(r.status).toBe('degradado');
    });
  });

  describe('estado del job de poblacion', () => {
    it('marca degradado si el latido esta por encima del umbral de antiguedad', () => {
      const r = buildHealthReport({
        ...base,
        heartbeat: latido({ finishedAt: new Date(AHORA - 3 * 60 * 60 * 1000).toISOString() }),
        maxHeartbeatAgeMs: 60 * 60 * 1000,
      });
      expect(check(r, 'job-de-poblacion').status).toBe('degradado');
      expect(check(r, 'job-de-poblacion').detail).toMatch(/por encima del umbral/);
    });

    it('informa cuantos datasets fallaron, sin ocultar que se sirve la version anterior', () => {
      const r = buildHealthReport({
        ...base,
        heartbeat: latido({
          datasets: [
            { datasetId: 'a', outcome: 'ok', durationMs: 10 },
            { datasetId: 'b', outcome: 'fallo', error: 'timeout', durationMs: 30 },
          ],
        }),
      });
      expect(check(r, 'job-de-poblacion').detail).toMatch(/1 de 2 datasets fallaron/);
    });

    it('sin latido alguno reporta degradado, no ok', () => {
      const r = buildHealthReport({ ...base, heartbeat: null });
      expect(check(r, 'job-de-poblacion').status).toBe('degradado');
      expect(check(r, 'conector-de-datos').detail).toMatch(/Conectividad desconocida/);
    });
  });

  it('detecta que el job todavia no recogio un cambio de conector', () => {
    const r = buildHealthReport({
      ...base,
      configuredConnector: 'sql',
      heartbeat: latido({ connector: 'mock' }),
    });
    expect(check(r, 'coherencia-de-conector').detail).toMatch(/aun no ha recogido el cambio/);
  });

  it('el estado global es el peor de las comprobaciones', () => {
    const r = buildHealthReport({
      ...base,
      cacheStoreReachable: false,
      identityDbReachable: false,
      heartbeat: latido(),
    });
    expect(r.status).toBe('caido');
  });
});

describe('summarizeHeartbeat', () => {
  it('cuenta los fallos', () => {
    expect(
      summarizeHeartbeat(
        latido({
          datasets: [
            { datasetId: 'a', outcome: 'ok', durationMs: 1 },
            { datasetId: 'b', outcome: 'fallo', durationMs: 1 },
            { datasetId: 'c', outcome: 'fallo', durationMs: 1 },
          ],
        }),
      ),
    ).toEqual({ total: 3, fallidos: 2, todosOk: false });
  });
});

describe('invariantes de auditoria', () => {
  it('una ampliacion de ambito no puede registrarse sin justificacion', () => {
    expect(() =>
      assertConfigChangeIsAuditable({
        kind: 'config-change',
        timestamp: new Date(AHORA).toISOString(),
        actorId: 'admin-1',
        entityType: 'scope',
        entityId: 'sc-1',
        action: 'scope-expansion',
        isScopeExpansion: true,
      }),
    ).toThrow(/no puede registrarse sin justificacion/);
  });

  it('con justificacion, la ampliacion se registra', () => {
    expect(() =>
      assertConfigChangeIsAuditable({
        kind: 'config-change',
        timestamp: new Date(AHORA).toISOString(),
        actorId: 'admin-1',
        entityType: 'scope',
        entityId: 'sc-1',
        action: 'scope-expansion',
        isScopeExpansion: true,
        justification: 'Auditoria nacional trimestral aprobada por el Consejo',
      }),
    ).not.toThrow();
  });

  it('un cambio normal no exige justificacion', () => {
    expect(() =>
      assertConfigChangeIsAuditable({
        kind: 'config-change',
        timestamp: new Date(AHORA).toISOString(),
        actorId: 'admin-1',
        entityType: 'team',
        entityId: 't-1',
        action: 'update',
        isScopeExpansion: false,
      }),
    ).not.toThrow();
  });

  it('una consulta al conector originada fuera del job es una violacion del principio 2', () => {
    expect(() =>
      assertQueryCameFromPopulator({
        kind: 'governed-query',
        timestamp: new Date(AHORA).toISOString(),
        connector: 'sql',
        datasetId: 'casos',
        request: {},
        durationMs: 10,
        outcome: 'ok',
        invokedBy: 'shell' as unknown as 'cache-populator',
      }),
    ).toThrow(/Solo el job de poblacion/);
  });
});
