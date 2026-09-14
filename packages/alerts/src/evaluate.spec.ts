import { describe, expect, it } from 'vitest';
import { decidirNotificacion, linkOf, evaluateRule, messageOf } from './evaluate';
import type { AlertRule, AlertState, Observacion } from './types';

/**
 * Lo que mas se vigila aqui es la regla de la TRANSICION. Una alerta que repite el mismo aviso
 * en cada ciclo de poblacion se desactiva en una semana, y una alerta desactivada no avisa de
 * nada: el fallo no se ve como un error, se ve como gente que ya no usa la funcion.
 */

const AHORA = new Date('2026-03-01T12:00:00.000Z');

const colorRule = (parcial: Partial<AlertRule> = {}): AlertRule => ({
  id: 'r1',
  name: 'Pendientes altos',
  ownerUserId: 'u-ana',
  teamId: 'equipo-norte',
  moduleSlug: 'casos-pendientes',
  instanceId: 'barras-distrito',
  measure: 'CasosPendientes',
  condition: { operator: 'mayor-que', threshold: 100 },
  filters: {},
  enabled: true,
  createdAt: '2026-02-01T00:00:00.000Z',
  ...parcial,
});

const obs = (...pares: [string, number][]): Observacion[] =>
  pares.map(([label, value]) => ({ label, value }));

describe('evaluateRule', () => {
  it('mayor-que nombra las categorias que superan el umbral, no solo el total', () => {
    const e = evaluateRule(colorRule(), obs(['Norte', 150], ['Sur', 80]), AHORA);

    expect(e.triggered).toBe(true);
    expect(e.matches).toEqual([{ label: 'Norte', value: 150 }]);
    expect(e.total).toBe(230);
  });

  it('no dispara cuando ninguna categoria cumple, aunque el total si', () => {
    // 60 + 60 = 120 supera 100, pero ninguna categoria lo hace. La regla se definio sobre las
    // categorias que el objeto muestra, y disparar por el total seria vigilar otra cosa.
    const e = evaluateRule(colorRule(), obs(['Norte', 60], ['Sur', 60]), AHORA);
    expect(e.triggered).toBe(false);
    expect(e.matches).toEqual([]);
  });

  it('menor-que dispara con las categorias que caen por debajo', () => {
    const e = evaluateRule(
      colorRule({ condition: { operator: 'menor-que', threshold: 50 } }),
      obs(['Norte', 150], ['Sur', 20]),
      AHORA,
    );
    expect(e.matches).toEqual([{ label: 'Sur', value: 20 }]);
  });

  it('cambia-mas-de no dispara en la primera evaluacion: fija la linea base', () => {
    // Sin valor previo no hay cambio que medir. Disparar aqui convertiria cada alerta recien
    // creada en un aviso inmediato y sin sentido.
    const e = evaluateRule(
      colorRule({ condition: { operator: 'cambia-mas-de', threshold: 10 } }),
      obs(['Norte', 150]),
      AHORA,
    );
    expect(e.triggered).toBe(false);
    expect(e.total).toBe(150);
  });

  it('cambia-mas-de dispara cuando el total se mueve mas que el umbral', () => {
    const previo: AlertState = { ruleId: 'r1', triggered: false, lastValue: 100 };
    const e = evaluateRule(
      colorRule({ condition: { operator: 'cambia-mas-de', threshold: 10 } }),
      obs(['Norte', 150]),
      AHORA,
      previo,
    );
    expect(e.triggered).toBe(true);
  });

  it('cambia-mas-de mide el cambio en los dos sentidos', () => {
    const previo: AlertState = { ruleId: 'r1', triggered: false, lastValue: 200 };
    const e = evaluateRule(
      colorRule({ condition: { operator: 'cambia-mas-de', threshold: 10 } }),
      obs(['Norte', 150]),
      AHORA,
      previo,
    );
    expect(e.triggered).toBe(true);
  });

  it('sin observaciones no dispara: un objeto vacio no es una alerta', () => {
    const e = evaluateRule(colorRule(), [], AHORA);
    expect(e.triggered).toBe(false);
    expect(e.total).toBe(0);
  });
});

describe('decidirNotificacion', () => {
  it('avisa en la transicion de tranquilo a disparado', () => {
    const e = evaluateRule(colorRule(), obs(['Norte', 150]), AHORA);
    const { notificacion, estado } = decidirNotificacion(colorRule(), e, undefined, AHORA);

    expect(notificacion?.kind).toBe('alerta');
    expect(notificacion?.subject).toBe('Alerta: Pendientes altos');
    expect(estado.triggered).toBe(true);
  });

  it('NO repite el aviso mientras la condicion se mantiene', () => {
    const previo: AlertState = { ruleId: 'r1', triggered: true, lastValue: 150 };
    const e = evaluateRule(colorRule(), obs(['Norte', 160]), AHORA);
    const { notificacion, estado } = decidirNotificacion(colorRule(), e, previo, AHORA);

    expect(notificacion).toBeUndefined();
    // El estado si se actualiza: el valor ha cambiado aunque no toque avisar.
    expect(estado.lastValue).toBe(160);
  });

  it('avisa tambien cuando la alerta se resuelve', () => {
    const previo: AlertState = { ruleId: 'r1', triggered: true, lastValue: 150 };
    const e = evaluateRule(colorRule(), obs(['Norte', 50]), AHORA);
    const { notificacion } = decidirNotificacion(colorRule(), e, previo, AHORA);

    expect(notificacion?.kind).toBe('alerta-resuelta');
    expect(notificacion?.subject).toBe('Resuelta: Pendientes altos');
  });

  it('no avisa mientras sigue sin cumplirse', () => {
    const previo: AlertState = { ruleId: 'r1', triggered: false, lastValue: 50 };
    const e = evaluateRule(colorRule(), obs(['Norte', 40]), AHORA);
    expect(decidirNotificacion(colorRule(), e, previo, AHORA).notificacion).toBeUndefined();
  });

  it('la notificacion va SOLO a quien creo la regla', () => {
    const e = evaluateRule(colorRule(), obs(['Norte', 150]), AHORA);
    const { notificacion } = decidirNotificacion(colorRule(), e, undefined, AHORA);
    expect(notificacion?.recipientUserId).toBe('u-ana');
  });
});

describe('messageOf', () => {
  it('nombra las categorias que cumplen, para no obligar a ir a buscarlas', () => {
    const e = evaluateRule(colorRule(), obs(['Norte', 150], ['Este', 120]), AHORA);
    expect(messageOf(colorRule(), e, true)).toContain('Norte: 150');
    expect(messageOf(colorRule(), e, true)).toContain('Este: 120');
  });

  it('con muchas categorias resume en vez de listar treinta', () => {
    const muchas = obs(...Array.from({ length: 9 }, (_, i) => [`D${i}`, 200] as [string, number]));
    const e = evaluateRule(colorRule(), muchas, AHORA);
    expect(messageOf(colorRule(), e, true)).toContain('y 4 mas');
  });
});

describe('linkOf', () => {
  it('lleva a la vista exacta que vigila la regla: la URL es el estado (4.11)', () => {
    expect(
      linkOf({
        moduleSlug: 'casos-pendientes',
        filters: { 'DimTribunal.Materia': ['Penal', 'Civil'] },
      }),
    ).toBe('/m/casos-pendientes?DimTribunal.Materia=Penal&DimTribunal.Materia=Civil');
  });

  it('sin filtros es la URL limpia del modulo', () => {
    expect(linkOf({ moduleSlug: 'casos-pendientes', filters: {} })).toBe('/m/casos-pendientes');
  });

  it('incluye la pagina cuando la regla vigila una concreta', () => {
    expect(linkOf({ moduleSlug: 'casos', pageSlug: 'detalle', filters: {} })).toBe(
      '/m/casos/detalle',
    );
  });
});
