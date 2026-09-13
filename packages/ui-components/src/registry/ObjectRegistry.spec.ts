import { describe, expect, it } from 'vitest';
import { PRESENTACION_MINIMA } from '../presentacion/contrato';
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
  presentation: PRESENTACION_MINIMA,
  ...overrides,
});

const objeto = (versions: ObjectVersion[]): VisualObjectDefinition => ({
  objectId: 'barras',
  icono: 'barras',
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
    // Los siete que 4.2 enumera son los INDEPENDIENTES. Los complementos se cuentan aparte:
    // no son objetos que se coloquen en la rejilla y el documento no los pide.
    const independientes = registro.list().filter((o) => !o.attachable);

    // 4.2 enumera un MINIMO, no una lista cerrada: dice que el panel ofrezca esos siete, no que
    // no pueda ofrecer mas. Por eso la comprobacion es de inclusion — el panel de filtros es un
    // objeto anadido despues— y sigue fallando si alguno de los siete desaparece.
    for (const exigido of [
      'barras', 'lineas', 'mapa', 'matriz', 'segmentador', 'tabla', 'tarjeta-kpi',
    ]) {
      expect(independientes.map((o) => o.objectId)).toContain(exigido);
    }
  });

  it('el panel de filtros agrupa hasta diez dimensiones y no mapea medidas', () => {
    const registro = new ObjectRegistry(catalogoInicial);
    const version = registro.latest('panel-de-filtros');
    expect(version?.dataContract.dimensions).toEqual({ min: 1, max: 10 });
    // Un filtro que mapeara una medida pediria agregar algo para filtrar por ello, que es otra
    // cosa y no la que este objeto hace.
    expect(version?.dataContract.measures).toEqual({ min: 0, max: 0 });
  });

  it('los complementos se declaran adjuntables y en la categoria complemento', () => {
    const registro = new ObjectRegistry(catalogoInicial);
    const complementos = registro.list().filter((o) => o.attachable);

    expect(complementos.map((o) => o.objectId).sort()).toEqual([
      'tabla-de-datos',
      'tooltip-explicativo',
    ]);
    // Un complemento lee el dataset de su anfitrion: no puede declarar ranuras propias, o el
    // editor pediria un mapeo para algo que no se enlaza contra nada.
    for (const complemento of complementos) {
      expect(complemento.category).toBe('complemento');
      for (const v of complemento.versions) {
        expect(v.dataContract.dimensions).toEqual({ min: 0, max: 0 });
        expect(v.dataContract.measures).toEqual({ min: 0, max: 0 });
      }
    }
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
    const after = registro.resolve('barras', '1.0.0');
    expect(after.version).toBe('1.0.0');
    expect(after.changelog).toBe(changelogOriginal);
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
