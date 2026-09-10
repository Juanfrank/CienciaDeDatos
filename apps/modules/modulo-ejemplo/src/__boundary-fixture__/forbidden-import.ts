/**
 * FIXTURE NEGATIVO — no forma parte de la aplicacion.
 *
 * Este archivo viola deliberadamente la regla de limites de dependencia de la seccion 3.1:
 * un proyecto etiquetado `type:module` importando `type:server-data`. Su unico proposito es
 * demostrar que la regla MUERDE, ejecutando tools/verify-module-boundaries.sh
 *
 * Si algun dia este archivo deja de producir un error de linter, la garantia del criterio de
 * aceptacion "ninguna solicitud de un modulo invoca IDataConnector.query() de forma directa"
 * se habra perdido en silencio. Por eso la verificacion vive en CI y no en una revision manual.
 *
 * Esta excluido del lint normal (--ignore-pattern en el target `lint` de modulo-ejemplo),
 * del typecheck (exclude en tsconfig.json) y de vitest (exclude en vitest.config.ts).
 */
import { MockDataConnector } from '@app/data-contracts-server';

export const conectorProhibido = MockDataConnector;
