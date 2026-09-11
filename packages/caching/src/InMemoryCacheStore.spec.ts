import { describe, expect, it } from 'vitest';
import { InMemoryCacheStore } from './InMemoryCacheStore';

const entrada = (value: string) => ({ value, generatedAt: '2026-09-11T08:00:00.000Z' });

describe('InMemoryCacheStore (L1, 6.3)', () => {
  it('devuelve lo guardado dentro del TTL', async () => {
    const store = new InMemoryCacheStore({ ttlMs: 1000 });
    await store.set('k', entrada('v'));
    expect((await store.get<string>('k'))?.value).toBe('v');
  });

  it('deja de devolver la entrada al vencer el TTL', async () => {
    let ahora = 0;
    const store = new InMemoryCacheStore({ ttlMs: 1000, now: () => ahora });
    await store.set('k', entrada('v'));
    ahora = 1001;
    expect(await store.get('k')).toBeNull();
  });

  it('conserva la entrada vencida para el camino de degradacion de 6.9', async () => {
    let ahora = 0;
    const store = new InMemoryCacheStore({ ttlMs: 1000, now: () => ahora });
    await store.set('k', entrada('v'));
    ahora = 5000;

    expect(await store.get('k')).toBeNull();
    const vencida = await store.getEvenIfExpired<string>('k');
    expect(vencida?.expired).toBe(true);
    expect(vencida?.entry.value).toBe('v');
  });

  it('invalida por prefijo, para la invalidacion dirigida de 6.5', async () => {
    const store = new InMemoryCacheStore();
    await store.set('ds:a:1', entrada('1'));
    await store.set('ds:a:2', entrada('2'));
    await store.set('ds:b:1', entrada('3'));

    await store.deleteByPrefix('ds:a:');
    expect(await store.get('ds:a:1')).toBeNull();
    expect(await store.get('ds:a:2')).toBeNull();
    expect((await store.get<string>('ds:b:1'))?.value).toBe('3');
  });

  it('acota la memoria del proceso descartando la entrada mas antigua', async () => {
    const store = new InMemoryCacheStore({ maxEntries: 2 });
    await store.set('a', entrada('1'));
    await store.set('b', entrada('2'));
    await store.set('c', entrada('3'));
    expect(store.size).toBe(2);
    expect(await store.get('a')).toBeNull();
  });
});
