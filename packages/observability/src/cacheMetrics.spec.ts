import { describe, expect, it } from 'vitest';
import { CacheMetrics } from './cacheMetrics';

/**
 * Lo que se vigila es que las cifras no se mientan entre si. Una metrica operativa que suma mal
 * es peor que no tenerla: se usa para decidir si hace falta un Redis o si el job va atrasado.
 */
describe('CacheMetrics', () => {
  it('una lectura sin dato no cuenta como acierto ni tiene procedencia', () => {
    const m = new CacheMetrics();
    m.registrar({ datasetId: 'd', status: 'generating', stale: false });

    const r = m.resumen();
    expect(r).toMatchObject({ total: 1, aciertos: 0, generating: 1, desdeL1: 0, desdeL2: 0 });
    expect(r.tasaDeAcierto).toBe(0);
  });

  it('separa lo servido desde L1 de lo servido desde L2', () => {
    // Es el dato que sustenta si conviene un Redis (6.1), en vez de decidirlo por intuicion.
    const m = new CacheMetrics();
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l1', stale: false });
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l2', stale: false });
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l2', stale: false });

    expect(m.resumen()).toMatchObject({ desdeL1: 1, desdeL2: 2, aciertos: 3 });
  });

  it('cuenta como degradada tanto la caida de L2 como el dato vencido', () => {
    const m = new CacheMetrics();
    m.registrar({ datasetId: 'd', status: 'degraded', servedFrom: 'l1', stale: false });
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l2', stale: true });
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l2', stale: false });

    // Cualquier valor distinto de cero es una incidencia, no una estadistica.
    expect(m.resumen().degradados).toBe(2);
  });

  it('la antiguedad que reporta es la MAXIMA, no la media', () => {
    // La media esconde justo el caso que importa: que alguien este viendo algo muy viejo.
    const m = new CacheMetrics();
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l2', stale: false, ageMs: 1_000 });
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l2', stale: false, ageMs: 90_000 });
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l1', stale: false, ageMs: 5_000 });

    expect(m.resumen().antiguedadMaximaMs).toBe(90_000);
  });

  it('sin lecturas no inventa una tasa de acierto', () => {
    // Un 0% con cero lecturas se leeria como un cache que no funciona.
    expect(new CacheMetrics().resumen().tasaDeAcierto).toBeNull();
  });

  it('reiniciar deja el acumulador a cero', () => {
    const m = new CacheMetrics();
    m.registrar({ datasetId: 'd', status: 'ok', servedFrom: 'l2', stale: false });
    m.reiniciar();
    expect(m.resumen().total).toBe(0);
  });
});
