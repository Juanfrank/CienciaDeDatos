/**
 * Modulo de ejemplo. Existe en el Entregable A para que el esqueleto de monorepo tenga un
 * consumidor real de los limites de dependencia, no como modulo de negocio terminado.
 */
import type { QueryRequest } from '@app/data-contracts';
import { contract } from '../module.contract';

/** Forma de la consulta que el modulo declara necesitar. */
export function describeQuery(): QueryRequest {
  return {
    measures: contract.consumes.measures,
    dimensions: contract.consumes.dimensions,
  };
}

export { contract };
