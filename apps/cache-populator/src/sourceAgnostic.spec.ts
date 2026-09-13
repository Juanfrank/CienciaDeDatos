import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InMemoryCacheStore } from '@app/caching';
import {
  MockDataConnector,
  SqlDataConnector,
  XmlaDataConnector,
  createDataConnector,
  isConnectorKind,
} from '@app/data-contracts-server';
import { populate } from './populate';

/** Prueba de fuente-agnosticismo — criterio de aceptacion de la seccion 2.4. */

const CONECTORES = ['mock', 'sql', 'xmla'] as const;

const configuracionDe = (kind: (typeof CONECTORES)[number]) => ({
  kind,
  sql: { server: 'pendiente', database: 'pendiente' },
  xmla: { endpoint: 'pendiente', catalog: 'pendiente' },
});

describe('2.4 — cambiar de conector es configuracion, no codigo', () => {
  it('una sola variable selecciona cualquiera de los tres conectores', () => {
    expect(createDataConnector(configuracionDe('mock'))).toBeInstanceOf(MockDataConnector);
    expect(createDataConnector(configuracionDe('sql'))).toBeInstanceOf(SqlDataConnector);
    expect(createDataConnector(configuracionDe('xmla'))).toBeInstanceOf(XmlaDataConnector);
  });

  it('el valor viene de configuracion externa y se valida antes de usarse', () => {
    // En produccion lo provee Azure App Configuration, no una variable horneada en el build,
    // para poder alternar en caliente sin redeploy (2.2).
    expect(isConnectorKind('mock')).toBe(true);
    expect(isConnectorKind('postgres')).toBe(false);
  });

  it('el job recorre el MISMO camino con los tres, sin ramas por tipo de conector', async () => {
    for (const kind of CONECTORES) {
      const cacheStore = new InMemoryCacheStore({ ttlMs: 60_000 });
      const resultado = await populate({
        connector: createDataConnector(configuracionDe(kind)),
        cacheStore,
        connectorKind: kind,
      });

      // Mismo tipo de resultado, mismas claves, mismo latido: el llamante no distingue.
      expect(resultado.heartbeat.connector).toBe(kind);
      expect(Object.keys(resultado.heartbeat).sort()).toEqual(
        expect.arrayContaining(['connector', 'connectorReachable', 'datasets', 'finishedAt', 'startedAt']),
      );
      expect(Array.isArray(resultado.heartbeat.datasets)).toBe(true);
    }
  });

  it('un conector no implementado falla limpio y no corrompe el cache', async () => {
    const cacheStore = new InMemoryCacheStore({ ttlMs: 60_000 });
    const { heartbeat } = await populate({
      connector: createDataConnector(configuracionDe('sql')),
      cacheStore,
      connectorKind: 'sql',
    });

    expect(heartbeat.connectorReachable).toBe(false);
    expect(heartbeat.datasets.every((d) => d.outcome === 'fallo')).toBe(true);
    // Y lo dice con claridad, nombrando la fase que lo implementa.
    expect(heartbeat.datasets[0]?.error).toMatch(/todavia no esta implementado/);
  });
});

/**
 * La comprobacion estructural: que NADA en apps/* ni en packages/ui-components nombre un
 * conector concreto.
 */
describe('2.4 — ni apps/* ni ui-components conocen la fuente', () => {
  const RAIZ = join(import.meta.dirname, '..', '..', '..');

  const recorrer = (dir: string, acumulado: string[] = []): string[] => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', 'dist', '.nx', 'e2e'].includes(entrada.name)) continue;
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta, acumulado);
      else if (/\.(ts|tsx)$/.test(entrada.name)) acumulado.push(ruta);
    }
    return acumulado;
  };

  /** Terminos que delatarian acoplamiento a una fuente concreta. */
  const PROHIBIDOS = [
    'XmlaDataConnector',
    'SqlDataConnector',
    'MockDataConnector',
    'data-contracts-server',
    'ADOMD',
    'connectionString',
  ];

  /** Quita comentarios antes de buscar. */
  const sinComentarios = (texto: string): string =>
    texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const revisar = (relativo: string, excepciones: string[] = []) => {
    const archivos = recorrer(join(RAIZ, relativo)).filter(
      (f) => !excepciones.some((e) => f.includes(e)),
    );
    expect(archivos.length).toBeGreaterThan(0);

    const hallazgos: string[] = [];
    for (const archivo of archivos) {
      const codigo = sinComentarios(readFileSync(archivo, 'utf8'));
      for (const termino of PROHIBIDOS) {
        if (codigo.includes(termino)) {
          hallazgos.push(`${archivo.replace(RAIZ, '')}: ${termino}`);
        }
      }
    }
    return hallazgos;
  };

  it('el shell no nombra ningun conector concreto', () => {
    expect(revisar('apps/shell')).toEqual([]);
  });

  it('los modulos de negocio tampoco', () => {
    // Se excluye el fixture negativo, que existe justamente para violar la regla.
    expect(revisar('apps/modules', ['__boundary-fixture__'])).toEqual([]);
  });

  it('packages/ui-components tampoco', () => {
    expect(revisar('packages/ui-components')).toEqual([]);
  });

  it('el unico proyecto que los nombra es el job de poblacion', () => {
    // Aqui SI deben aparecer: es el unico autorizado. Si esta prueba fallara, significaria que
    // el job dejo de ser quien habla con la fuente.
    const propios = revisar('apps/cache-populator', ['sourceAgnostic.spec']);
    expect(propios.length).toBeGreaterThan(0);
  });
});
