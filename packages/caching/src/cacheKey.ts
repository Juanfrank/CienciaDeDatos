import { createHash } from 'node:crypto';
import type { FieldRef, QueryContext } from '@app/data-contracts';

/**
 * Diseño de la clave de cache — seccion 6.8. CRITICO PARA SEGURIDAD.
 *
 * La regla que hace cumplir este modulo no es de rendimiento: una violacion aqui es una fuga
 * de datos con RLS. Nunca puede servirse desde cache un resultado calculado para un contexto
 * de seguridad a otro distinto, aunque la consulta nominal sea identica.
 *
 * Formato:
 *   ds:{datasetId}:{hash(dimensiones+filtros no ligados a RLS)}
 *   ds:{datasetId}:{hash(...)}:sec:{hash(securityContext)}   <- si esta ligado a un contexto
 */

/**
 * Como se relaciona un dataset con el contexto de seguridad (6.6). Debe declararse
 * explicitamente por dataset en el registro, nunca quedar implicito.
 *
 * - `none`: el dataset se cachea SIN el filtro de ambito (el superconjunto que la consulta
 *   necesita) y `resolveEffectiveScope` se aplica como paso posterior y barato sobre el
 *   resultado ya leido. El mismo dataset sirve a equipos distintos, cada uno viendo su
 *   subconjunto. Es la estrategia preferida: maximiza la reutilizacion sin debilitar el
 *   aislamiento, porque el filtrado sigue ocurriendo antes de que el dato salga al cliente.
 *
 * - `connector-native`: la fuente aplico su propio RLS (`getCapabilities().nativeRls`), asi
 *   que el resultado llega ya filtrado y queda ligado a un contexto de seguridad concreto.
 *   La clave DEBE incluir el hash de ese contexto, sacrificando parte de la reutilizacion
 *   antes que debilitar el aislamiento (principio 5, no negociable).
 */
export type SecurityBinding = 'none' | 'connector-native';

export interface CacheKeyInput {
  datasetId: string;
  dimensions?: FieldRef[];
  /** Filtros de la consulta. Incluye, sin distincion, los de la interfaz y los de la URL (4.11). */
  filters?: Record<string, unknown>;
  securityBinding: SecurityBinding;
  /** Obligatorio cuando securityBinding es 'connector-native'. */
  securityContext?: QueryContext['securityContext'];
}

/** Serializacion canonica: mismo contenido, misma cadena, sin depender del orden de escritura. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Los valores de un filtro son un conjunto: su orden no cambia lo que la consulta pide.
    const items = value.map(canonicalize);
    return items.map((v) => JSON.stringify(v)).sort();
  }
  if (value && typeof value === 'object') {
    const entradas = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, canonicalize(v)] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entradas);
  }
  return value;
}

export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex').slice(0, 16);
}

/**
 * Clave del SchemaDescriptor cacheado (6.4).
 *
 * Vive aqui y no en el job porque es un CONTRATO entre dos procesos: el job lo escribe y tanto
 * el camino de lectura como el editor de modulos (4.2) y el editor de ambitos (4.10.8) lo leen.
 * Un contrato compartido no puede vivir dentro de uno de los dos lados.
 */
export const SCHEMA_CACHE_KEY = 'ops:schema:descriptor';

/** Prefijo de un dataset, para invalidacion dirigida con deleteByPrefix (6.5). */
export function datasetKeyPrefix(datasetId: string): string {
  return `ds:${datasetId}:`;
}

/**
 * Construye la clave de cache de un resultado.
 *
 * Falla de forma ruidosa si un dataset ligado a un contexto de seguridad intenta construir
 * su clave sin ese contexto. Esa es la unica forma de que el error mas peligroso del sistema
 * —compartir entre ambitos un resultado ya filtrado— sea imposible de cometer por descuido.
 */
export function buildCacheKey(input: CacheKeyInput): string {
  const { datasetId, dimensions, filters, securityBinding, securityContext } = input;

  if (!datasetId) throw new Error('La clave de cache requiere un datasetId.');

  const consulta = stableHash({ dimensions: dimensions ?? [], filters: filters ?? {} });
  const base = `${datasetKeyPrefix(datasetId)}${consulta}`;

  if (securityBinding === 'none') {
    // El securityContext NO entra en la clave: es justo lo que permite que el mismo dataset
    // cacheado sirva a equipos con ambitos distintos (6.6).
    return base;
  }

  if (!securityContext) {
    throw new Error(
      `El dataset '${datasetId}' esta ligado a un contexto de seguridad ` +
        `(securityBinding: 'connector-native') y su clave de cache no puede construirse sin ` +
        `securityContext. Servirlo con una clave compartida seria una fuga de datos con RLS.`,
    );
  }

  return `${base}:sec:${stableHash(securityContext)}`;
}
