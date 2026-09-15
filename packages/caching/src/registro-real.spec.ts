import { describe, expect, it } from 'vitest';
import { defaultRegistry, validateRegistry } from './datasetRegistry';

/**
 * El registro REAL de la aplicacion (6.6), no uno de ejemplo.
 *
 * `validateRegistry` existia, estaba exportada y la ejercitaba su propia prueba unitaria con
 * registros inventados: nadie la hacia pasar por `datasets/registry.json`, que es el archivo que
 * de verdad se publica. Un `datasetId` repetido, un `securityBinding` invalido o una decision sin
 * motivo escrito salian del repositorio sin que nada chistara, y el fallo se descubria cuando una
 * lectura trae el dataset equivocado — el peor momento para enterarse.
 *
 * Va en este paquete y no en las pruebas de coherencia del repositorio porque el registro es un
 * archivo de ESTE paquete, y porque `type:tooling` no puede depender de `type:server`.
 */
describe('el registro de datasets publicado es coherente (6.6)', () => {
  it('no tiene ningun problema declarado', () => {
    const problemas = validateRegistry(defaultRegistry);
    expect(
      problemas,
      problemas.map((p) => `${p.datasetId}: ${p.problem}`).join('\n'),
    ).toEqual([]);
  });

  it('y hay datasets que comprobar, no una lista vacia', () => {
    // Sin esto, vaciar el registro dejaria la comprobacion de arriba en verde.
    expect(defaultRegistry.datasets.length).toBeGreaterThan(0);
  });
});
