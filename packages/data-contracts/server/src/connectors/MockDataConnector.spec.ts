import { describe, expect, it } from 'vitest';
import type { QueryContext, QueryRequest } from '@app/data-contracts';
import { MockDataConnector } from './MockDataConnector';

const ctx = (securityContext: QueryContext['securityContext'] = {}): QueryContext => ({
  userId: 'u-1',
  userPrincipalName: 'persona@institucion.gob',
  roles: ['visor'],
  securityContext,
});

const distritoYMedida: QueryRequest = {
  dimensions: [{ table: 'DimTribunal', field: 'Distrito' }],
  measures: ['CasosIngresados'],
};

describe('MockDataConnector', () => {
  it('declara por defecto las capacidades del camino sin RLS nativo', () => {
    expect(new MockDataConnector().getCapabilities()).toEqual({
      nativeRls: false,
      calculationGroups: false,
      supportsTimeIntelligence: true,
    });
  });

  it('devuelve un SchemaDescriptor sin metadatos de generacion', async () => {
    const schema = await new MockDataConnector().getSchema();
    const campos = schema.tables.flatMap((t) => t.fields);
    expect(campos.length).toBeGreaterThan(0);
    for (const campo of campos) {
      // Lo que NO puede salir es lo que solo sirve para generar datos sinteticos: si un modulo
      // pudiera leer `sampleValues` o `range`, dependeria de algo que la fuente real no tiene.
      // Se comprueba asi y no con una lista cerrada de claves, que rechazaba cualquier campo
      // nuevo del contrato publico —`isKey` lo es— sin que hubiera ninguna fuga.
      expect(campo).not.toHaveProperty('sampleValues');
      expect(campo).not.toHaveProperty('range');
      expect(campo).not.toHaveProperty('cardinality');
    }
    expect(schema.measures.map((m) => m.name)).toContain('CasosIngresados');
    // La agregacion SI es contrato publico: es lo que dice como resumir cada medida.
    expect(schema.measures.find((m) => m.name === 'DiasResolucion')?.aggregation).toBe('promedio');
  });

  it('genera datos deterministas: misma semilla, mismos valores', async () => {
    const a = await new MockDataConnector({ seed: 42 }).query(distritoYMedida, ctx());
    const b = await new MockDataConnector({ seed: 42 }).query(distritoYMedida, ctx());
    expect(a.rows).toEqual(b.rows);
  });

  it('cambia los valores al cambiar la semilla', async () => {
    const a = await new MockDataConnector({ seed: 1 }).query(distritoYMedida, ctx());
    const b = await new MockDataConnector({ seed: 2 }).query(distritoYMedida, ctx());
    expect(a.rows).not.toEqual(b.rows);
  });

  it('marca la procedencia como mock', async () => {
    const res = await new MockDataConnector().query(distritoYMedida, ctx());
    expect(res.source).toBe('mock');
    expect(() => new Date(res.generatedAt).toISOString()).not.toThrow();
  });

  it('aplica filtros de QueryRequest sobre las dimensiones', async () => {
    const res = await new MockDataConnector().query(
      { ...distritoYMedida, filters: { 'DimTribunal.Distrito': ['Distrito Norte'] } },
      ctx(),
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]?.[0]).toBe('Distrito Norte');
  });

  it('respeta topN y orderBy', async () => {
    const res = await new MockDataConnector().query(
      { ...distritoYMedida, orderBy: [{ field: 'CasosIngresados', direction: 'desc' }], topN: 2 },
      ctx(),
    );
    expect(res.rows).toHaveLength(2);
    const [first, segunda] = res.rows as [unknown[], unknown[]];
    expect(Number(first[1])).toBeGreaterThanOrEqual(Number(segunda[1]));
  });

  it('rechaza dimensiones que no existen en el esquema activo, en vez de fallar en silencio', async () => {
    await expect(
      new MockDataConnector().query(
        { dimensions: [{ table: 'DimTribunal', field: 'CampoInventado' }] },
        ctx(),
      ),
    ).rejects.toThrow(/Dimension desconocida/);
  });

  it('rechaza medidas no certificadas', async () => {
    await expect(
      new MockDataConnector().query({ measures: ['MedidaInventada'] }, ctx()),
    ).rejects.toThrow(/Medida no certificada/);
  });

  describe('interaccion con RLS (seccion 6.6)', () => {
    it('con nativeRls=false devuelve el superconjunto, para que el dataset se pueda compartir entre equipos', async () => {
      const conector = new MockDataConnector({ capabilities: { nativeRls: false } });
      const res = await conector.query(distritoYMedida, ctx({ 'DimTribunal.Distrito': ['Distrito Norte'] }));
      // El securityContext NO recorta el resultado: el ambito lo aplica la aplicacion
      // (4.10.4) despues de leer del cache.
      expect(res.rows.length).toBeGreaterThan(1);
    });

    it('con nativeRls=true la fuente filtra, y el dataset queda ligado a un contexto de seguridad', async () => {
      const conector = new MockDataConnector({ capabilities: { nativeRls: true } });
      const res = await conector.query(distritoYMedida, ctx({ 'DimTribunal.Distrito': ['Distrito Norte'] }));
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0]?.[0]).toBe('Distrito Norte');
    });

    it('dos contextos de seguridad distintos producen resultados distintos con nativeRls=true', async () => {
      const conector = new MockDataConnector({ capabilities: { nativeRls: true } });
      const norte = await conector.query(distritoYMedida, ctx({ 'DimTribunal.Distrito': ['Distrito Norte'] }));
      const este = await conector.query(distritoYMedida, ctx({ 'DimTribunal.Distrito': ['Distrito Este'] }));
      expect(norte.rows).not.toEqual(este.rows);
    });
  });
});
