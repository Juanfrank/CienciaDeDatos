import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryResult } from '@app/data-contracts';
import { gobiernoFixtures, resolveEffectiveScope } from '@app/access-control';
import { CachedDatasetReader, type CacheReadEvent } from './CachedDatasetReader';
import { CacheStoreUnavailableError, type CacheEntry, type ICacheStore } from './ICacheStore';
import { InMemoryCacheStore } from './InMemoryCacheStore';
import type { CacheableDataset, DatasetRegistry } from './datasetRegistry';

const { arbolGeneral, equipoEste, equipoNorte, usuarioAna, usuarioBeto } = gobiernoFixtures;

/** Dataset compartido: se cachea sin filtro de ambito y se filtra al leer (6.6). */
const datasetCasos: CacheableDataset = {
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
  grainRationale: 'fixture: agrupado, con medidas aditivas.',
  recurrence: '0 * * * *',
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
};

const registry: DatasetRegistry = { datasets: [datasetCasos] };

const datasetCacheado: QueryResult = {
  columns: [
    { name: 'DimTribunal.Distrito', type: 'string' },
    { name: 'DimTribunal.Materia', type: 'string' },
    { name: 'CasosPendientes', type: 'number' },
  ],
  rows: [
    ['Distrito Norte', 'Penal', 10],
    ['Distrito Norte', 'Laboral', 11],
    ['Distrito Este', 'Penal', 20],
    ['Distrito Este', 'Civil', 21],
    ['Distrito Sur', 'Penal', 30],
  ],
  source: 'mock',
  generatedAt: '2026-09-11T08:00:00.000Z',
};

const entrada: CacheEntry<QueryResult> = {
  value: datasetCacheado,
  generatedAt: '2026-09-11T08:00:00.000Z',
};

class FakeL2 implements ICacheStore {
  readonly map = new Map<string, CacheEntry<unknown>>();
  available = true;
  gets = 0;

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    this.gets++;
    if (!this.available) throw new CacheStoreUnavailableError('FakeL2');
    return (this.map.get(key) as CacheEntry<T>) ?? null;
  }
  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.available) throw new CacheStoreUnavailableError('FakeL2');
    this.map.set(key, entry as CacheEntry<unknown>);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async deleteByPrefix(prefix: string): Promise<void> {
    for (const k of [...this.map.keys()]) if (k.startsWith(prefix)) this.map.delete(k);
  }
}

const ambitoDe = (user: typeof usuarioAna, team: typeof equipoNorte, moduleId: string) =>
  resolveEffectiveScope({ user, activeTeam: team, moduleId, generalTree: arbolGeneral }).scope;

describe('CachedDatasetReader', () => {
  let l1: InMemoryCacheStore;
  let l2: FakeL2;
  let eventos: CacheReadEvent[];
  let reader: CachedDatasetReader;

  beforeEach(() => {
    l1 = new InMemoryCacheStore({ ttlMs: 5_000 });
    l2 = new FakeL2();
    eventos = [];
    reader = new CachedDatasetReader({ l1, l2, registry, onRead: (e) => eventos.push(e) });
  });

  const sembrar = async () => {
    const key = reader.keyFor(datasetCasos, {});
    await l2.set(key, entrada);
    return key;
  };

  describe('el usuario nunca dispara una consulta a la fuente (6.3)', () => {
    it('sin entrada en ninguna capa devuelve "generandose", no un error ni una consulta', async () => {
      const r = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });
      expect(r.status).toBe('generating');
      expect(r.result).toBeUndefined();
    });

    it('lee de L2 y promueve a L1', async () => {
      await sembrar();
      const primera = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });
      expect(primera.servedFrom).toBe('l2');

      const segunda = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });
      expect(segunda.servedFrom).toBe('l1');
      // L1 evita el segundo round-trip al Storage Account.
      expect(l2.gets).toBe(1);
    });

    it('expone la marca de tiempo del dato servido, para mostrarla en el modulo (4.8)', async () => {
      await sembrar();
      const r = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });
      expect(r.generatedAt).toBe('2026-09-11T08:00:00.000Z');
    });
  });

  describe('un dataset, varios ambitos (6.6 y criterio de aceptacion de la seccion 9)', () => {
    it('dos equipos con ambitos distintos leen la MISMA entrada y reciben subconjuntos distintos', async () => {
      await sembrar();

      const norte = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });
      const este = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioBeto, equipoEste, 'casos-pendientes-este'),
      });

      // Una sola escritura de poblacion satisface ambas lecturas: no hay entradas redundantes.
      expect(l2.map.size).toBe(1);

      // El equipo Norte esta en la carpeta Norte y restringido a Penal/Civil.
      expect(norte.result?.rows).toEqual([['Distrito Norte', 'Penal', 10]]);
      // El equipo Este ve su distrito, sin restriccion de materia.
      expect(este.result?.rows).toEqual([
        ['Distrito Este', 'Penal', 20],
        ['Distrito Este', 'Civil', 21],
      ]);
    });

    it('dos modulos distintos que consumen el mismo dataset leen la misma entrada', async () => {
      await sembrar();
      await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });
      await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-este'),
      });
      expect(l2.map.size).toBe(1);
      expect(eventos.every((e) => e.key === eventos[0]?.key)).toBe(true);
    });
  });

  describe('filtros pedidos, incluidos los de la URL (4.11)', () => {
    it('un filtro dentro del ambito restringe el resultado', async () => {
      await sembrar();
      const r = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioBeto, equipoEste, 'casos-pendientes-este'),
        requestedFilters: { 'DimTribunal.Materia': 'Penal' },
      });
      expect(r.result?.rows).toEqual([['Distrito Este', 'Penal', 20]]);
    });

    it('un filtro fuera del ambito no amplia el resultado', async () => {
      await sembrar();
      // Alguien del equipo Este abre una URL filtrada al Distrito Norte.
      const r = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioBeto, equipoEste, 'casos-pendientes-este'),
        requestedFilters: { 'DimTribunal.Distrito': 'Distrito Norte' },
      });
      expect(r.result?.rows).toEqual([]);
      expect(r.appliedFilters?.['DimTribunal.Distrito']).toEqual([]);
    });
  });

  describe('resiliencia si el Storage de cache no esta disponible (6.9)', () => {
    it('sigue sirviendo desde L1 el ultimo dato valido, marcandolo como degradado', async () => {
      await sembrar();
      await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });

      // Cae L2 y ademas vence el TTL de L1.
      l2.available = false;
      vi.spyOn(l1, 'get').mockResolvedValue(null);

      const r = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });

      expect(r.status).toBe('degraded');
      expect(r.stale).toBe(true);
      expect(r.servedFrom).toBe('l1');
      // Honesto: la fecha que se muestra es la del ultimo dato valido conocido.
      expect(r.generatedAt).toBe('2026-09-11T08:00:00.000Z');
      expect(r.result?.rows).toEqual([['Distrito Norte', 'Penal', 10]]);
    });

    it('si L2 cae y L1 nunca tuvo el dato, devuelve "generandose" sin consultar la fuente', async () => {
      l2.available = false;
      const r = await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });
      expect(r.status).toBe('generating');
    });
  });

  describe('observabilidad (6.9 y seccion 7)', () => {
    it('emite de donde se sirvio y que antiguedad tenia el dato', async () => {
      await sembrar();
      await reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      });
      expect(eventos[0]).toMatchObject({ datasetId: 'casos', status: 'ok', servedFrom: 'l2', stale: false });
      expect(typeof eventos[0]?.ageMs).toBe('number');
    });
  });

  it('rechaza servir un dataset que no puede hacer cumplir el ambito', async () => {
    const sinDistrito: QueryResult = {
      columns: [{ name: 'CasosPendientes', type: 'number' }],
      rows: [[1]],
      source: 'mock',
      generatedAt: '2026-09-11T08:00:00.000Z',
    };
    await l2.set(reader.keyFor(datasetCasos, {}), {
      value: sinDistrito,
      generatedAt: '2026-09-11T08:00:00.000Z',
    });

    await expect(
      reader.read({
        datasetId: 'casos',
        scope: ambitoDe(usuarioAna, equipoNorte, 'casos-pendientes-norte'),
      }),
    ).rejects.toThrow(/no expone la\(s\) dimension\(es\)/);
  });

  it('falla de forma explicita ante un dataset no registrado', async () => {
    await expect(
      reader.read({ datasetId: 'inventado', scope: { restrictions: [] } }),
    ).rejects.toThrow(/no esta en el registro/);
  });
});
