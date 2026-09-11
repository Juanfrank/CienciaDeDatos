import { describe, expect, it } from 'vitest';
import { CronParseError, isDue, matchesCron, parseCron } from './schedule';

const utc = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));

describe('parseCron', () => {
  it('separa los cinco campos', () => {
    expect(parseCron('0 */4 * * *')).toEqual({
      minute: '0', hour: '*/4', dayOfMonth: '*', month: '*', dayOfWeek: '*',
    });
  });

  it('rechaza expresiones que no tienen cinco campos', () => {
    expect(() => parseCron('0 * * *')).toThrow(CronParseError);
    expect(() => parseCron('')).toThrow(CronParseError);
  });
});

describe('matchesCron — las expresiones que el registro usa de verdad', () => {
  it('cada 15 minutos: indicador casi en tiempo real', () => {
    expect(matchesCron('*/15 * * * *', utc(2026, 9, 11, 8, 0))).toBe(true);
    expect(matchesCron('*/15 * * * *', utc(2026, 9, 11, 8, 15))).toBe(true);
    expect(matchesCron('*/15 * * * *', utc(2026, 9, 11, 8, 30))).toBe(true);
    expect(matchesCron('*/15 * * * *', utc(2026, 9, 11, 8, 7))).toBe(false);
  });

  it('cada 4 horas en punto: carga por lotes', () => {
    expect(matchesCron('0 */4 * * *', utc(2026, 9, 11, 8, 0))).toBe(true);
    expect(matchesCron('0 */4 * * *', utc(2026, 9, 11, 12, 0))).toBe(true);
    expect(matchesCron('0 */4 * * *', utc(2026, 9, 11, 9, 0))).toBe(false);
    expect(matchesCron('0 */4 * * *', utc(2026, 9, 11, 8, 30))).toBe(false);
  });

  it('admite listas y rangos', () => {
    expect(matchesCron('0 9,17 * * *', utc(2026, 9, 11, 17, 0))).toBe(true);
    expect(matchesCron('0 9-11 * * *', utc(2026, 9, 11, 10, 0))).toBe(true);
    expect(matchesCron('0 9-11 * * *', utc(2026, 9, 11, 12, 0))).toBe(false);
  });

  it('evalua en UTC, igual que Azure', () => {
    // 2026-09-11T08:00:00Z es la referencia; no depende del huso de la maquina.
    expect(matchesCron('0 8 * * *', new Date('2026-09-11T08:00:00.000Z'))).toBe(true);
  });

  it('aplica la convencion de cron cuando dia-del-mes y dia-de-semana estan ambos restringidos', () => {
    // 2026-09-11 es viernes (dia 5). Con ambos restringidos basta que se cumpla uno.
    expect(matchesCron('0 0 1 * 5', utc(2026, 9, 11, 0, 0))).toBe(true);
    expect(matchesCron('0 0 11 * 1', utc(2026, 9, 11, 0, 0))).toBe(true);
    expect(matchesCron('0 0 1 * 1', utc(2026, 9, 11, 0, 0))).toBe(false);
  });

  it('rechaza valores fuera de rango', () => {
    expect(() => matchesCron('0 25 * * *', utc(2026, 9, 11, 8, 0))).toThrow(CronParseError);
    expect(() => matchesCron('60 * * * *', utc(2026, 9, 11, 8, 0))).toThrow(CronParseError);
  });
});

describe('isDue', () => {
  it('un dataset nunca poblado SIEMPRE toca', () => {
    // Si esperara a que la recurrencia coincidiera, un dataset horario tardaria hasta una hora
    // en aparecer tras un despliegue y la persona veria "generandose" sin motivo.
    expect(isDue('0 */4 * * *', undefined, utc(2026, 9, 11, 9, 37))).toBe(true);
  });

  it('no toca si la recurrencia no se ha cumplido desde la ultima ejecucion', () => {
    expect(isDue('0 */4 * * *', utc(2026, 9, 11, 8, 0).toISOString(), utc(2026, 9, 11, 9, 0))).toBe(false);
  });

  it('toca cuando la recurrencia se cumple entre la ultima ejecucion y ahora', () => {
    expect(isDue('0 */4 * * *', utc(2026, 9, 11, 8, 0).toISOString(), utc(2026, 9, 11, 12, 0))).toBe(true);
  });

  it('no pierde disparos si el ciclo del job se retrasa', () => {
    // El job debia correr a las 12:00 pero corre a las 12:07. La ventana 08:01-12:07 contiene
    // las 12:00, asi que toca. Comprobar solo el minuto actual lo habria perdido, y justo pasa
    // cuando mas carga hay.
    expect(isDue('0 */4 * * *', utc(2026, 9, 11, 8, 0).toISOString(), utc(2026, 9, 11, 12, 7))).toBe(true);
  });

  it('una marca de tiempo invalida se trata como "nunca poblado"', () => {
    expect(isDue('0 */4 * * *', 'no es una fecha', utc(2026, 9, 11, 9, 0))).toBe(true);
  });

  it('acota el recorrido si el latido quedo muy atras', () => {
    const haceUnAno = utc(2025, 9, 11, 8, 0).toISOString();
    expect(isDue('0 */4 * * *', haceUnAno, utc(2026, 9, 11, 8, 0))).toBe(true);
  });
});
