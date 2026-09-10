/**
 * Modulo de ejemplo. Existe en el Entregable A para que el esqueleto de monorepo tenga un
 * consumidor real de los limites de dependencia, no como modulo de negocio terminado.
 *
 * Demuestra la arista PERMITIDA del grafo: un modulo importa TIPOS de @app/data-contracts.
 * La arista prohibida (importar @app/data-contracts-server) vive en __boundary-fixture__/
 * y se verifica con tools/verify-module-boundaries.sh
 */
import type { QueryRequest } from '@app/data-contracts';
import { contract } from '../module.contract';

/**
 * Forma de la consulta que el modulo declara necesitar.
 *
 * El modulo NO la ejecuta: la declara. Quien la ejecuta contra la fuente es el job de
 * poblacion de cache (6.4), y el modulo lee el resultado ya cacheado y ya filtrado por
 * el ambito efectivo de quien mira (4.10.4).
 */
export function describeQuery(): QueryRequest {
  return {
    measures: contract.consumes.measures,
    dimensions: contract.consumes.dimensions,
  };
}

export { contract };
