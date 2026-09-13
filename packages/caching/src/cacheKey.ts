import { createHash } from 'node:crypto';
import type { FieldRef, QueryContext } from '@app/data-contracts';

/** Diseño de la clave de cache — seccion 6.8. CRITICO PARA SEGURIDAD. */

/**
 * Como se relaciona un dataset con el contexto de seguridad (6.6). Debe declararse
 * explicitamente por dataset en el registro, nunca quedar implicito.
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

/** Clave del SchemaDescriptor cacheado (6.4). */
export const SCHEMA_CACHE_KEY = 'ops:schema:descriptor';

/** Prefijo de un dataset, para invalidacion dirigida con deleteByPrefix (6.5). */
export function datasetKeyPrefix(datasetId: string): string {
  return `ds:${datasetId}:`;
}

/** Construye la clave de cache de un resultado. */
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
