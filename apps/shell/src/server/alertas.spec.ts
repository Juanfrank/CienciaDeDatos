import { describe, expect, it } from 'vitest';
import { evaluarRegla, type AlertRule } from '@app/alerts';
import { observacionesDe } from './alertas';

/** La decision de seguridad de toda la funcion, probada donde se toma. */

const regla = (parcial: Partial<AlertRule>): AlertRule => ({
  id: 'r-prueba',
  name: 'Prueba',
  ownerUserId: 'u-ana',
  teamId: 'equipo-norte',
  moduleSlug: 'casos-pendientes',
  instanceId: 'barras-distrito',
  measure: 'CasosPendientes',
  condition: { operator: 'mayor-que', threshold: 0 },
  filters: {},
  enabled: true,
  createdAt: '2026-03-01T00:00:00.000Z',
  ...parcial,
});

describe('observacionesDe: una alerta ve exactamente lo que ve su dueno', () => {
  it('las observaciones del equipo Norte solo alcanzan su distrito', async () => {
    const observaciones = await observacionesDe(regla({}));

    expect(observaciones).not.toBeNull();
    expect(observaciones?.length).toBeGreaterThan(0);
    expect(observaciones?.map((o) => o.label)).toEqual(['Distrito Norte']);
  });

  it('la misma medida vista por otro equipo da otras cifras, no las del primero', async () => {
    const norte = await observacionesDe(regla({}));
    const este = await observacionesDe(
      regla({
        ownerUserId: 'u-beto',
        teamId: 'equipo-este',
        moduleSlug: 'casos-este',
        instanceId: 'barras-este',
      }),
    );

    expect(este).not.toBeNull();
    // El objeto del Este agrupa por materia dentro de SU distrito: ninguna etiqueta ni ningun
    // total puede coincidir con el recorte del Norte.
    expect(este?.map((o) => o.label)).not.toContain('Distrito Norte');

    const total = (obs: { value: number }[] | null) => (obs ?? []).reduce((t, o) => t + o.value, 0);
    expect(total(este)).not.toBe(total(norte));
  });

  it('los filtros de la regla acotan la observacion, como acotan la pantalla', async () => {
    const withoutFilter = await observacionesDe(regla({}));
    const soloPenal = await observacionesDe(
      regla({ filters: { 'DimTribunal.Materia': ['Penal'] } }),
    );

    const total = (obs: { value: number }[] | null) => (obs ?? []).reduce((t, o) => t + o.value, 0);
    expect(total(soloPenal)).toBeLessThan(total(withoutFilter));
    expect(total(soloPenal)).toBeGreaterThan(0);
  });
});

describe('una regla que ya no se puede evaluar se distingue de una que no dispara', () => {
  it('devuelve null cuando el equipo no tiene concedido el modulo', async () => {
    // 'estadisticas' existe en la organizacion general pero vive fuera de lo concedido al
    // equipo Norte. Devolver una lista vacia seria decir "ninguna categoria cumple", y eso
    // RESOLVERIA una alerta que en realidad ya no se puede evaluar.
    expect(await observacionesDe(regla({ moduleSlug: 'estadisticas', instanceId: 'kpi-nacional' }))).toBeNull();
  });

  it('devuelve null cuando el modulo ya no existe', async () => {
    expect(await observacionesDe(regla({ moduleSlug: 'modulo-borrado' }))).toBeNull();
  });

  it('devuelve null cuando el objeto vigilado ya no esta en el modulo', async () => {
    expect(await observacionesDe(regla({ instanceId: 'objeto-borrado' }))).toBeNull();
  });

  it('una lista vacia SI significa "no hay nada que cumpla", y eso resuelve la alerta', () => {
    // La distincion entre null y [] es lo que mantiene honesto el mensaje de "ya no se cumple".
    const evaluacion = evaluarRegla(regla({}), [], new Date());
    expect(evaluacion.triggered).toBe(false);
  });
});

describe('la regla se evalua sobre lo que el objeto MUESTRA', () => {
  it('una tarjeta KPI sin dimensiones da una sola observacion, su total', async () => {
    const observaciones = await observacionesDe(
      regla({ instanceId: 'kpi-pendientes', measure: 'CasosPendientes' }),
    );

    expect(observaciones).toHaveLength(1);
    expect(observaciones?.[0]?.label).toBe('total');
  });

  it('un grafico da una observacion por categoria, ya agregada', async () => {
    const observaciones = await observacionesDe(regla({}));
    // El dataset trae cuatro trimestres por combinacion; el grafico muestra una barra por
    // distrito. La alerta vigila la barra, no las filas.
    expect(observaciones).toHaveLength(1);
    expect(observaciones?.[0]?.value).toBeGreaterThan(100);
  });
});
