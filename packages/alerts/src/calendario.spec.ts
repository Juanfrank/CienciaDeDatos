import { describe, expect, it } from 'vitest';
import { debeEntregarse, describirCadencia, inicioDelPeriodo } from './calendario';
import type { Subscription } from './types';

/**
 * La entrega se decide preguntando "¿toca ya?" en cada vuelta, no con un temporizador por
 * suscripcion. Estas pruebas fijan la consecuencia que importa: una entrega no se pierde porque
 * el proceso estuviera caido a la hora exacta, y no se repite porque el proceso se reiniciara.
 */

const sub = (parcial: Partial<Subscription> = {}): Subscription => ({
  id: 's1',
  name: 'Casos cada lunes',
  ownerUserId: 'u-ana',
  teamId: 'equipo-norte',
  moduleSlug: 'casos-pendientes',
  filters: {},
  format: 'pdf',
  cadence: 'diaria',
  hour: 8,
  enabled: true,
  ...parcial,
});

/** Fechas locales, que es como se define la hora de entrega para quien la configura. */
const local = (texto: string) => new Date(texto);

describe('debeEntregarse (diaria)', () => {
  it('no entrega antes de la hora programada', () => {
    expect(debeEntregarse(sub(), local('2026-03-02T07:30:00'))).toBe(false);
  });

  it('entrega al llegar la hora si no se ha entregado hoy', () => {
    expect(debeEntregarse(sub(), local('2026-03-02T08:00:00'))).toBe(true);
  });

  it('no repite una entrega ya hecha en el mismo periodo', () => {
    const s = sub({ lastDeliveredAt: local('2026-03-02T08:00:00').toISOString() });
    expect(debeEntregarse(s, local('2026-03-02T14:00:00'))).toBe(false);
  });

  it('una entrega perdida por un proceso caido se recupera, no se salta', () => {
    // La hora era las 8:00 y el proceso volvio a las 11:00. La entrega del dia sigue debiendose.
    const s = sub({ lastDeliveredAt: local('2026-03-01T08:00:00').toISOString() });
    expect(debeEntregarse(s, local('2026-03-02T11:00:00'))).toBe(true);
  });

  it('una suscripcion desactivada no entrega nunca', () => {
    expect(debeEntregarse(sub({ enabled: false }), local('2026-03-02T09:00:00'))).toBe(false);
  });

  it('con un archivo ya en cola no se encola otro', () => {
    // Sin esto, dos vueltas seguidas antes de que el trabajo termine entregarian dos veces.
    expect(debeEntregarse(sub({ pendingJobId: 'job-1' }), local('2026-03-02T09:00:00'))).toBe(false);
  });
});

describe('debeEntregarse (semanal)', () => {
  const semanal = sub({ cadence: 'semanal', weekday: 1, hour: 8 }); // lunes

  it('no entrega el domingo anterior', () => {
    expect(debeEntregarse(semanal, local('2026-03-01T09:00:00'))).toBe(false);
  });

  it('entrega el lunes a su hora', () => {
    expect(debeEntregarse(semanal, local('2026-03-02T08:00:00'))).toBe(true);
  });

  it('no vuelve a entregar el resto de la semana', () => {
    const s = { ...semanal, lastDeliveredAt: local('2026-03-02T08:00:00').toISOString() };
    expect(debeEntregarse(s, local('2026-03-05T10:00:00'))).toBe(false);
  });

  it('vuelve a entregar el lunes siguiente', () => {
    const s = { ...semanal, lastDeliveredAt: local('2026-03-02T08:00:00').toISOString() };
    expect(debeEntregarse(s, local('2026-03-09T08:00:00'))).toBe(true);
  });
});

describe('debeEntregarse (mensual)', () => {
  it('entrega el dia del mes configurado', () => {
    const s = sub({ cadence: 'mensual', monthday: 5, hour: 6 });
    expect(debeEntregarse(s, local('2026-03-04T23:00:00'))).toBe(false);
    expect(debeEntregarse(s, local('2026-03-05T06:00:00'))).toBe(true);
  });

  it('el dia 31 en un mes de 28 entrega el ultimo dia, no se salta el mes', () => {
    // Una comparacion literal de fecha perderia febrero entero, y quien configuro "fin de mes"
    // no recibiria nada sin enterarse de por que.
    const s = sub({ cadence: 'mensual', monthday: 31, hour: 6 });
    expect(debeEntregarse(s, local('2026-02-28T06:00:00'))).toBe(true);
  });
});

describe('inicioDelPeriodo', () => {
  it('la semana empieza en domingo', () => {
    expect(inicioDelPeriodo('semanal', local('2026-03-05T15:00:00')).getDay()).toBe(0);
  });

  it('el mes empieza el dia 1', () => {
    expect(inicioDelPeriodo('mensual', local('2026-03-17T15:00:00')).getDate()).toBe(1);
  });
});

describe('describirCadencia', () => {
  it('se lee sin traducir numeros de dia', () => {
    expect(describirCadencia(sub())).toBe('Cada dia a las 08:00');
    expect(describirCadencia(sub({ cadence: 'semanal', weekday: 1 }))).toBe(
      'Cada lunes a las 08:00',
    );
    expect(describirCadencia(sub({ cadence: 'mensual', monthday: 5 }))).toBe(
      'El dia 5 de cada mes a las 08:00',
    );
  });
});
