import type { ConnectorKind, QueryRequest } from '@app/data-contracts';

/** Formas de evento estructurado para Application Insights — seccion 7. */

/** Log estructurado de cada consulta directa gobernada (2.3). */
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

/** Log de cambios de configuracion de roles, equipos y ambitos (4.10.7 y seccion 7). */
export interface ConfigChangeLog {
  kind: 'config-change';
  timestamp: string;
  actorId: string;
  // `object` es un objeto del catalogo. El catalogo es codigo, pero la DECISION de certificar
  // una version, o de dejar de ofrecerla en el editor, la toma una persona aqui y tiene que
  // constar igual que cualquier otro cambio de configuracion (seccion 7).
  entityType:
    | 'team'
    | 'membership'
    | 'nav-node'
    | 'scope'
    | 'package'
    | 'role'
    | 'module'
    | 'object';
  entityId: string;
  action:
    | 'create'
    | 'update'
    | 'delete'
    | 'move'
    // Deja de ofrecerse en el editor, sin desaparecer de los modulos que ya lo tienen: retirar
    // y romper no son lo mismo, y el registro distingue las dos.
    | 'disable'
    | 'enable'
    | 'scope-expansion'
    // Transiciones del ciclo de vida de un modulo (4.1). Van como acciones propias y no como
    // 'update' porque publicar no es editar: cambia QUIEN ve el modulo, y esa es la fila que un
    // Administrador busca cuando revisa que se publico y quien lo aprobo.
    | 'submit'
    | 'publish'
    | 'withdraw';
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

/** Valida que un evento de cambio de configuracion que amplia ambito lleve justificacion. */
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
