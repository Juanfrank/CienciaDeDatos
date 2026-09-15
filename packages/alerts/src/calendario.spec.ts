import { describe, expect, it } from 'vitest';
import { deliverMust, cadenceDescribe, periodHome } from './calendario';
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
const local = (content: string) => new Date(content);

describe('deliverMust (diaria)', () => {
  it('no entrega antes de la hora programada', () => {
    expect(deliverMust(sub(), local('2026-03-02T07:30:00'))).toBe(false);
  });

  it('entrega al llegar la hora si no se ha entregado hoy', () => {
    expect(deliverMust(sub(), local('2026-03-02T08:00:00'))).toBe(true);
  });

  it('no repite una entrega ya hecha en el mismo periodo', () => {
    const s = sub({ lastDeliveredAt: local('2026-03-02T08:00:00').toISOString() });
    expect(deliverMust(s, local('2026-03-02T14:00:00'))).toBe(false);
  });

  it('una entrega perdida por un proceso caido se recupera, no se salta', () => {
    // La hora era las 8:00 y el proceso volvio a las 11:00. La entrega del dia sigue debiendose.
    const s = sub({ lastDeliveredAt: local('2026-03-01T08:00:00').toISOString() });
    expect(deliverMust(s, local('2026-03-02T11:00:00'))).toBe(true);
  });

  it('una suscripcion desactivada no entrega nunca', () => {
    expect(deliverMust(sub({ enabled: false }), local('2026-03-02T09:00:00'))).toBe(false);
  });

  it('con un archivo ya en cola no se encola otro', () => {
    // Sin esto, dos vueltas seguidas antes de que el trabajo termine entregarian dos veces.
    expect(deliverMust(sub({ pendingJobId: 'job-1' }), local('2026-03-02T09:00:00'))).toBe(false);
  });
});

describe('deliverMust (semanal)', () => {
  const semanal = sub({ cadence: 'semanal', weekday: 1, hour: 8 }); // lunes

  it('no entrega el domingo anterior', () => {
    expect(deliverMust(semanal, local('2026-03-01T09:00:00'))).toBe(false);
  });

  it('entrega el lunes a su hora', () => {
    expect(deliverMust(semanal, local('2026-03-02T08:00:00'))).toBe(true);
  });

  it('no vuelve a entregar el resto de la semana', () => {
    const s = { ...semanal, lastDeliveredAt: local('2026-03-02T08:00:00').toISOString() };
    expect(deliverMust(s, local('2026-03-05T10:00:00'))).toBe(false);
  });

  it('vuelve a entregar el lunes siguiente', () => {
    const s = { ...semanal, lastDeliveredAt: local('2026-03-02T08:00:00').toISOString() };
    expect(deliverMust(s, local('2026-03-09T08:00:00'))).toBe(true);
  });
});

describe('deliverMust (mensual)', () => {
  it('entrega el dia del mes configurado', () => {
    const s = sub({ cadence: 'mensual', monthday: 5, hour: 6 });
    expect(deliverMust(s, local('2026-03-04T23:00:00'))).toBe(false);
    expect(deliverMust(s, local('2026-03-05T06:00:00'))).toBe(true);
  });

  it('el dia 31 en un mes de 28 entrega el ultimo dia, no se salta el mes', () => {
    // Una comparacion literal de fecha perderia febrero entero, y quien configuro "fin de mes"
    // no recibiria nada sin enterarse de por que.
    const s = sub({ cadence: 'mensual', monthday: 31, hour: 6 });
    expect(deliverMust(s, local('2026-02-28T06:00:00'))).toBe(true);
  });
});

describe('periodHome', () => {
  it('la semana empieza en domingo', () => {
    expect(periodHome('semanal', local('2026-03-05T15:00:00')).getDay()).toBe(0);
  });

  it('el mes empieza el dia 1', () => {
    expect(periodHome('mensual', local('2026-03-17T15:00:00')).getDate()).toBe(1);
  });
});

describe('cadenceDescribe', () => {
  it('se lee sin traducir numeros de dia', () => {
    expect(cadenceDescribe(sub())).toBe('Cada dia a las 08:00');
    expect(cadenceDescribe(sub({ cadence: 'semanal', weekday: 1 }))).toBe(
      'Cada lunes a las 08:00',
    );
    expect(cadenceDescribe(sub({ cadence: 'mensual', monthday: 5 }))).toBe(
      'El dia 5 de cada mes a las 08:00',
    );
  });
});

describe('un dia imposible no se cuela en el calendario', () => {
  /**
   * Una fecha invalida no da error: compara `false` con todo.
   *
   * `programada.setDate(x + NaN)` deja una fecha invalida, y entonces `ahora < programada` sale
   * falso a cualquier hora de cualquier dia. La entrega se da por vencida SIEMPRE, y la
   * suscripcion sale la primera vez que el trabajador la mire — de madrugada, un martes, da
   * igual lo que dijera la configuracion.
   *
   * Que la ruta valide la entrada no cierra esto: en el almacen puede haber suscripciones
   * guardadas antes de que la ruta validara.
   */
  it('un dia de la semana que no es un numero no la vuelve exigible a cualquier hora', () => {
    const rota = sub({ cadence: 'semanal', weekday: Number.NaN, hour: 8 });
    // Lunes de madrugada: con el dia por defecto (domingo a las 8) ya toco, pero la cifra que
    // importa es que la decision se tome sobre una fecha VALIDA.
    expect(deliverMust(rota, local('2026-03-01T07:00:00'))).toBe(false);
    expect(deliverMust(rota, local('2026-03-01T09:00:00'))).toBe(true);
  });

  it('un dia de la semana fuera de rango no la manda tres meses por delante', () => {
    // Con 99, la fecha programada cae en diciembre y la suscripcion no se entrega nunca.
    const rota = sub({ cadence: 'semanal', weekday: 99, hour: 8 });
    expect(deliverMust(rota, local('2026-03-05T09:00:00'))).toBe(true);
  });

  it('un dia del mes fuera de rango tampoco', () => {
    const rota = sub({ cadence: 'mensual', monthday: 0, hour: 8 });
    expect(deliverMust(rota, local('2026-03-01T09:00:00'))).toBe(true);

    const otra = sub({ cadence: 'mensual', monthday: 99, hour: 8 });
    expect(deliverMust(otra, local('2026-03-20T09:00:00'))).toBe(true);
  });

  it('una hora imposible no deja la suscripcion sin entregar para siempre', () => {
    // Con la fecha invalida, la segunda comparacion —«¿se entrego ya en este periodo?»— tambien
    // sale falsa, y una suscripcion que ya se entrego una vez no se vuelve a entregar nunca.
    // Por eso se prueba CON entrega anterior: sin ella, el fallo y el arreglo dicen lo mismo.
    const rota = sub({
      cadence: 'diaria',
      hour: Number.NaN,
      lastDeliveredAt: local('2026-03-01T09:00:00').toISOString(),
    });
    expect(deliverMust(rota, local('2026-03-02T09:00:00'))).toBe(true);
  });

  it('el rotulo tampoco ensena «NaN» ni un dia que no existe', () => {
    // Es lo que ve quien abre la lista de suscripciones: un rotulo con «NaN» no dice que la
    // configuracion este rota, dice que la aplicacion lo esta.
    expect(cadenceDescribe(sub({ cadence: 'semanal', weekday: Number.NaN }))).toBe(
      'Cada lunes a las 08:00',
    );
    expect(cadenceDescribe(sub({ cadence: 'mensual', monthday: 99 }))).toBe(
      'El dia 1 de cada mes a las 08:00',
    );
    expect(cadenceDescribe(sub({ cadence: 'diaria', hour: Number.NaN }))).toBe(
      'Cada dia a las 00:00',
    );
  });
});
