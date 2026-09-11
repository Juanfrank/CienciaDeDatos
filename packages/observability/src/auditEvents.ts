import type { ConnectorKind, QueryRequest } from '@app/data-contracts';

/**
 * Formas de evento estructurado para Application Insights — seccion 7.
 *
 * Se declaran como tipos y no como texto libre para que las consultas del panel operativo
 * (docs/observabilidad.md) puedan contar con una forma estable.
 */

/**
 * Log estructurado de cada consulta directa gobernada (2.3).
 *
 * Solo lo emite el job de poblacion: es el unico que invoca al conector. Que exista un
 * `connector` en cada traza es lo que hace VERIFICABLE el criterio de aceptacion de la
 * seccion 9 —"el conector solo se invoca desde el job de poblacion, nunca desde el camino de
 * lectura de una solicitud de usuario"— mediante una consulta, no mediante una revision.
 */
export interface GovernedQueryLog {
  kind: 'governed-query';
  timestamp: string;
  connector: ConnectorKind;
  datasetId: string;
  /** Id de la consulta registrada en sql-queries/registry.json, si el conector es SQL (2.3). */
  registeredQueryId?: string;
  request: QueryRequest;
  durationMs: number;
  rowCount?: number;
  outcome: 'ok' | 'fallo';
  error?: string;
  /** Componente que la origino. Debe ser SIEMPRE 'cache-populator'. */
  invokedBy: 'cache-populator';
}

/**
 * Log de cambios de configuracion de roles, equipos y ambitos (4.10.7 y seccion 7).
 *
 * Las excepciones de ampliacion de ambito llevan marca propia para poder mostrarlas de forma
 * destacada, no mezcladas indistintamente con el resto de cambios.
 */
export interface ConfigChangeLog {
  kind: 'config-change';
  timestamp: string;
  actorId: string;
  entityType: 'team' | 'membership' | 'nav-node' | 'scope' | 'package' | 'role';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'move' | 'scope-expansion';
  before?: unknown;
  after?: unknown;
  /** Obligatoria cuando isScopeExpansion es true. */
  justification?: string;
  isScopeExpansion: boolean;
}

/** Metrica de salud del cache: no de rendimiento, sino de si el dato servido es reciente (6.9). */
export interface CacheServeLog {
  kind: 'cache-serve';
  timestamp: string;
  datasetId: string;
  servedFrom: 'l1' | 'l2' | 'ninguno';
  hit: boolean;
  stale: boolean;
  /** Antiguedad del dato servido. La antiguedad promedio es metrica de salud operativa. */
  ageMs?: number;
}

/**
 * Valida que un evento de cambio de configuracion que amplia ambito lleve justificacion.
 *
 * La justificacion es obligatoria en el modelo (4.10.4). Se comprueba tambien aqui, al emitir
 * el log, para que una ampliacion nunca quede registrada sin motivo: el panel de auditoria es
 * inutil si la fila que mas importa esta vacia.
 */
export function assertConfigChangeIsAuditable(event: ConfigChangeLog): void {
  if (event.isScopeExpansion && !event.justification?.trim()) {
    throw new Error(
      'Una ampliacion de ambito no puede registrarse sin justificacion (4.10.4). ' +
        'El evento de auditoria es el unico rastro de por que alguien vio mas de lo que su ' +
        'equipo permite.',
    );
  }
}

/** Verifica la invariante del principio 2 sobre una traza de consulta. */
export function assertQueryCameFromPopulator(log: GovernedQueryLog): void {
  if (log.invokedBy !== 'cache-populator') {
    throw new Error(
      `Consulta al conector originada en '${String(log.invokedBy)}'. Solo el job de poblacion ` +
        `puede invocar IDataConnector.query() (principio 2).`,
    );
  }
}
