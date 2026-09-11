import { describe, expect, it } from 'vitest';
import { ObjectRegistry, ObjectRegistryError } from './ObjectRegistry';
import { catalogoInicial } from './catalog';
import type { ObjectInstance, ObjectVersion, VisualObjectDefinition } from './types';

const certificado = { testsPassed: true, reviewedBy: 'equipo-plataforma', reviewedAt: '2026-09-11' };

const version = (v: string, overrides: Partial<ObjectVersion> = {}): ObjectVersion => ({
  version: v,
  publishedAt: '2026-09-11',
  changelog: `Cambios de ${v}.`,
  certification: certificado,
  dataContract: { dimensions: { min: 1, max: 1 }, measures: { min: 1, max: 1 } },
  ...overrides,
});

const objeto = (versions: ObjectVersion[]): VisualObjectDefinition => ({
  objectId: 'barras',
  name: 'Barras',
  description: 'd',
  category: 'grafico',
  versions,
});

const instancia = (objectId: string, v: string): ObjectInstance => ({
  instanceId: `i-${objectId}-${v}`,
  objectId,
  version: v,
  binding: { datasetId: 'casos', dimensions: [{ table: 'DimTribunal', field: 'Distrito' }], measures: ['CasosPendientes'] },
});

describe('catalogo inicial (4.2)', () => {
  it('registra los siete objetos prediseñados que nombra el documento', () => {
    const registro = new ObjectRegistry(catalogoInicial);
    expect(registro.list().map((o) => o.objectId).sort()).toEqual([
      'barras', 'lineas', 'mapa', 'matriz', 'segmentador', 'tabla', 'tarjeta-kpi',
    ]);
  });

  it('todas las versiones del catalogo traen changelog y certificacion', () => {
    for (const objeto of catalogoInicial) {
      for (const v of objeto.versions) {
        expect(v.changelog.trim().length).toBeGreaterThan(0);
        expect(v.certification.testsPassed).toBe(true);
        expect(v.certification.reviewedBy.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('fijacion de version (criterio de aceptacion de la seccion 9)', () => {
  it('publicar una version nueva NO altera la que una instancia ya fijo', () => {
    const registro = new ObjectRegistry([objeto([version('1.0.0')])]);
    const fijada = registro.resolve('barras', '1.0.0');
    const changelogOriginal = fijada.changelog;

    registro.publish({
      objectId: 'barras',
      version: version('2.0.0', { changelog: 'Cambio incompatible en el eje.' }),
    });

    // La instancia sigue resolviendo exactamente lo que fijo.
    const despues = registro.resolve('barras', '1.0.0');
    expect(despues.version).toBe('1.0.0');
    expect(despues.changelog).toBe(changelogOriginal);
    // Y la ultima ya es otra, sin que eso afecte a lo anterior.
    expect(registro.latest('barras')?.version).toBe('2.0.0');
  });

  it('resolve exige la version EXACTA: no admite rangos ni "la ultima"', () => {
    const registro = new ObjectRegistry([objeto([version('1.0.0'), version('1.2.0')])]);
    expect(() => registro.resolve('barras', '^1.0.0')).toThrow(ObjectRegistryError);
    expect(() => registro.resolve('barras', '1.1.0')).toThrow(/no tiene la version/);
  });

  it('no se puede republicar una version existente', () => {
    const registro = new ObjectRegistry([objeto([version('1.0.0')])]);
    expect(() => registro.publish({ objectId: 'barras', version: version('1.0.0') })).toThrow(
      /ya existe/,
    );
  });

  it('una version debe avanzar: no se admite retroceder', () => {
    const registro = new ObjectRegistry([objeto([version('2.0.0')])]);
    expect(() => registro.publish({ objectId: 'barras', version: version('1.9.0') })).toThrow(
      /no avanza respecto/,
    );
  });
});

describe('requisitos de publicacion (4.5)', () => {
  it('rechaza publicar sin changelog', () => {
    const registro = new ObjectRegistry([objeto([version('1.0.0')])]);
    expect(() =>
      registro.publish({ objectId: 'barras', version: version('1.1.0', { changelog: '   ' }) }),
    ).toThrow(/no trae changelog/);
  });

  it('rechaza publicar sin las pruebas en verde', () => {
    const registro = new ObjectRegistry([objeto([version('1.0.0')])]);
    expect(() =>
      registro.publish({
        objectId: 'barras',
        version: version('1.1.0', { certification: { ...certificado, testsPassed: false } }),
      }),
    ).toThrow(/no tiene las pruebas en verde/);
  });

  it('rechaza publicar sin revision por pares: las pruebas no la sustituyen', () => {
    const registro = new ObjectRegistry([objeto([version('1.0.0')])]);
    expect(() =>
      registro.publish({
        objectId: 'barras',
        version: version('1.1.0', { certification: { ...certificado, reviewedBy: '' } }),
      }),
    ).toThrow(/no tiene revision por pares/);
  });

  it('rechaza una version que no sea MAYOR.MENOR.PARCHE', () => {
    expect(() => new ObjectRegistry([objeto([version('1.0')])])).toThrow(/Version no valida/);
  });

  it('rechaza un contrato de datos incoherente', () => {
    expect(() =>
      new ObjectRegistry([
        objeto([version('1.0.0', { dataContract: { dimensions: { min: 3, max: 1 }, measures: { min: 0, max: 1 } } })]),
      ]),
    ).toThrow(/el minimo supera al maximo/);
  });
});

describe('politica de deprecacion (4.5)', () => {
  const conDeprecacion = () => {
    const registro = new ObjectRegistry([objeto([version('1.0.0')])]);
    registro.publish({ objectId: 'barras', version: version('2.0.0') });
    registro.deprecate('barras', '1.0.0', {
      announcedAt: '2026-09-01',
      removeAfter: '2026-12-01',
      replacedBy: '2.0.0',
      reason: 'El eje categorico cambia de contrato en 2.0.0.',
    });
    return registro;
  };

  it('avisa de forma ACTIVA a las instancias que usan una version deprecada', () => {
    const avisos = conDeprecacion().findDeprecationWarnings(
      [instancia('barras', '1.0.0'), instancia('barras', '2.0.0')],
      new Date('2026-11-01'),
    );
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({
      version: '1.0.0',
      replacedBy: '2.0.0',
      daysRemaining: 30,
      expired: false,
    });
  });

  it('marca como vencida una instancia que paso la fecha limite', () => {
    const avisos = conDeprecacion().findDeprecationWarnings(
      [instancia('barras', '1.0.0')],
      new Date('2027-01-15'),
    );
    expect(avisos[0]?.expired).toBe(true);
    expect(avisos[0]?.daysRemaining).toBeLessThan(0);
  });

  it('ordena los avisos por urgencia', () => {
    const registro = conDeprecacion();
    registro.publish({ objectId: 'barras', version: version('2.1.0') });
    registro.deprecate('barras', '2.0.0', {
      announcedAt: '2026-09-01',
      removeAfter: '2027-06-01',
      replacedBy: '2.1.0',
      reason: 'Sustituida por 2.1.0.',
    });
    const avisos = registro.findDeprecationWarnings(
      [instancia('barras', '2.0.0'), instancia('barras', '1.0.0')],
      new Date('2026-11-01'),
    );
    expect(avisos.map((a) => a.version)).toEqual(['1.0.0', '2.0.0']);
  });

  it('rechaza un aviso que apunta a una version sustituta inexistente', () => {
    const registro = new ObjectRegistry([objeto([version('1.0.0')])]);
    expect(() =>
      registro.deprecate('barras', '1.0.0', {
        announcedAt: '2026-09-01',
        removeAfter: '2026-12-01',
        replacedBy: '9.9.9',
        reason: 'x',
      }),
    ).toThrow(/no es accionable/);
  });

  it('una instancia en una version sin deprecar no genera aviso', () => {
    const avisos = conDeprecacion().findDeprecationWarnings([instancia('barras', '2.0.0')]);
    expect(avisos).toEqual([]);
  });
});
