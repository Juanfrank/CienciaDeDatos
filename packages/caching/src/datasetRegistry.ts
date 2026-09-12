import type { FieldRef, GranoDeDataset, QueryRequest } from '@app/data-contracts';
import { dimensionKey } from '@app/access-control';
import type { SecurityBinding } from './cacheKey';
import registryFile from '../datasets/registry.json' with { type: 'json' };

/**
 * Registro de datasets cacheables — seccion 6.6.
 *
 * Cuando distintos modulos necesitan la misma medida, o una variante filtrada de la misma
 * informacion, la estrategia prioriza cachear el dataset UNA SOLA VEZ y reutilizarlo, en vez
 * de que cada modulo mantenga su propia entrada redundante para, en esencia, el mismo dato.
 *
 * Un modulo que necesita una vista mas especifica de un dataset ya cacheado debe resolverla
 * filtrando o agregando sobre el dataset ya cacheado, en el backend — nunca generando una
 * nueva consulta a la fuente ni una entrada de cache redundante.
 */
export interface CacheableDataset {
  datasetId: string;
  description: string;
  /** La consulta en su forma mas amplia razonable, sin los filtros de un modulo puntual. */
  query: QueryRequest;
  /**
   * El grano al que queda el dataset. Se declara con su motivo, igual que `securityBinding` y por
   * la misma razon: cambia lo que la aplicacion puede calcular despues sobre el cache, asi que no
   * puede quedar implicito en la forma de la consulta. Ninguno de los dos valores es «el
   * correcto»: es un intercambio entre tamaño y que se puede preguntar luego. Lo que no vale es
   * no haberlo decidido, que es como un promedio acaba sumandose.
   */
  grain: GranoDeDataset;
  grainRationale: string;
  /** Recurrencia por dominio de datos (6.4): minutos o horas segun la frescura que exija. */
  recurrence: string;
  recurrenceRationale: string;
  /** Obligatorio y explicito: nunca se decide caso por caso sin registrar (6.6). */
  securityBinding: SecurityBinding;
  securityBindingRationale: string;
  /**
   * Dimensiones por las que algun consumidor puede quedar restringido.
   *
   * No esta en el documento: se añade porque un dataset con `securityBinding: 'none'` se
   * comparte entre ambitos y solo puede filtrarse al leerlo si TRAE esas dimensiones como
   * columnas. Declararlas permite detectar el hueco al validar el registro, en vez de
   * descubrirlo en produccion cuando un ambito no se pueda hacer cumplir.
   */
  scopeDimensions?: FieldRef[];
  consumedByModules: string[];
  owner: string;
  registeredAt: string;
}

export interface DatasetRegistry {
  datasets: CacheableDataset[];
}

export class UnknownDatasetError extends Error {
  constructor(readonly datasetId: string) {
    super(
      `El dataset '${datasetId}' no esta en el registro (packages/caching/datasets/registry.json). ` +
        `Todo dataset cacheable se declara ahi, con su recurrencia y su securityBinding.`,
    );
    this.name = 'UnknownDatasetError';
  }
}

export const defaultRegistry: DatasetRegistry = registryFile as unknown as DatasetRegistry;

export function getDataset(datasetId: string, registry: DatasetRegistry = defaultRegistry): CacheableDataset {
  const dataset = registry.datasets.find((d) => d.datasetId === datasetId);
  if (!dataset) throw new UnknownDatasetError(datasetId);
  return dataset;
}

/** Datasets que un modulo consume, para trazabilidad contra su module.contract.ts (3.3). */
export function datasetsForModule(moduleId: string, registry: DatasetRegistry = defaultRegistry): CacheableDataset[] {
  return registry.datasets.filter((d) => d.consumedByModules.includes(moduleId));
}

export interface RegistryProblem {
  datasetId: string;
  problem: string;
}

/**
 * Valida el registro. Lo ejecuta una prueba, para que un registro incoherente rompa CI en vez
 * de producir un fallo de aislamiento silencioso en produccion.
 */
export function validateRegistry(registry: DatasetRegistry = defaultRegistry): RegistryProblem[] {
  const problemas: RegistryProblem[] = [];
  const vistos = new Set<string>();

  for (const d of registry.datasets) {
    if (vistos.has(d.datasetId)) {
      problemas.push({ datasetId: d.datasetId, problem: 'datasetId duplicado en el registro.' });
    }
    vistos.add(d.datasetId);

    if (d.securityBinding !== 'none' && d.securityBinding !== 'connector-native') {
      problemas.push({
        datasetId: d.datasetId,
        problem: `securityBinding invalido: '${String(d.securityBinding)}'. Debe ser 'none' o 'connector-native'.`,
      });
    }

    if (!d.securityBindingRationale?.trim()) {
      problemas.push({
        datasetId: d.datasetId,
        problem: 'Falta securityBindingRationale: la estrategia de aislamiento no puede quedar implicita (6.6).',
      });
    }

    if (!d.recurrence?.trim()) {
      problemas.push({ datasetId: d.datasetId, problem: 'Falta recurrence: cada dataset declara la suya (6.4).' });
    }

    if (d.grain !== 'atomico' && d.grain !== 'preagregado') {
      problemas.push({
        datasetId: d.datasetId,
        problem: `grain invalido: '${String(d.grain)}'. Debe ser 'atomico' o 'preagregado'.`,
      });
    }

    if (!d.grainRationale?.trim()) {
      problemas.push({
        datasetId: d.datasetId,
        problem:
          'Falta grainRationale: el grano decide que se puede calcular despues sobre el cache ' +
          '(un promedio no se recalcula desde filas ya agrupadas), asi que se declara con su motivo.',
      });
    }

    if (d.consumedByModules.length === 0) {
      problemas.push({ datasetId: d.datasetId, problem: 'Ningun modulo lo consume: o se declara el consumidor, o se retira.' });
    }

    // La comprobacion que evita una fuga: si el dataset se comparte entre ambitos, tiene que
    // traer como columna toda dimension por la que alguien pueda quedar restringido.
    if (d.securityBinding === 'none' && d.scopeDimensions?.length) {
      const declaradas = new Set((d.query.dimensions ?? []).map(dimensionKey));
      for (const dim of d.scopeDimensions) {
        if (!declaradas.has(dimensionKey(dim))) {
          problemas.push({
            datasetId: d.datasetId,
            problem:
              `La dimension de ambito '${dimensionKey(dim)}' no esta entre las dimensiones de la ` +
              `consulta. Un dataset compartido entre ambitos no puede filtrarse por una dimension ` +
              `que no trae como columna.`,
          });
        }
      }
    }
  }

  return problemas;
}
