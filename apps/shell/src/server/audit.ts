import type { ConfigChangeLog } from '@app/observability';
import { assertConfigChangeIsAuditable } from '@app/observability';
import type { TreeAuditEvent } from '@app/access-control';
import { KEY_AUDIT, mutar, write, readList } from './almacenCompartido';

/** Registro de auditoria de configuracion — secciones 4.10.7 y 7. */
/** Los eventos viven en el almacen COMPARTIDO. */
const readEvents = (): Promise<ConfigChangeLog[]> => readList<ConfigChangeLog>(KEY_AUDIT);

export interface RecordChangeInput {
  actorId: string;
  entityType: ConfigChangeLog['entityType'];
  entityId: string;
  action: ConfigChangeLog['action'];
  before?: unknown;
  after?: unknown;
  justification?: string;
  isScopeExpansion?: boolean;
}

/** Registra un cambio de configuracion. */
export async function changeRecord(input: RecordChangeInput): Promise<ConfigChangeLog> {
  const evento: ConfigChangeLog = {
    kind: 'config-change',
    timestamp: new Date().toISOString(),
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    ...(input.before !== undefined ? { before: input.before } : {}),
    ...(input.after !== undefined ? { after: input.after } : {}),
    ...(input.justification ? { justification: input.justification } : {}),
    isScopeExpansion: input.isScopeExpansion ?? false,
  };

  assertConfigChangeIsAuditable(evento);
  // Anadir bajo turno, no leer-y-escribir: dos cambios de configuracion a la vez y uno de los
  // dos no quedaba anotado. Un registro que a veces pierde la fila que importa no sirve para
  // lo que existe, y la ampliacion de ambito —la que §4.10.4 obliga a justificar— es
  // exactamente la fila que llega acompanada de otras.
  await mutar<ConfigChangeLog[]>(KEY_AUDIT, (actuales) => [...(actuales ?? []), evento]);
  return evento;
}

/** Traduce un evento de dominio del arbol al formato del log de configuracion. */
export async function treeEventRecord(evento: TreeAuditEvent): Promise<ConfigChangeLog> {
  return changeRecord({
    actorId: evento.actorId,
    entityType: 'nav-node',
    entityId: evento.nodeId,
    action: evento.action === 'mover' ? 'move' : actionMap(evento.action),
    ...(evento.scopeBefore ? { before: evento.scopeBefore } : {}),
    ...(evento.scopeAfter ? { after: evento.scopeAfter } : {}),
    // Un movimiento NO es una ampliacion por si mismo: puede restringir igual que ampliar. Lo
    // que hace es cambiar el ambito heredado, y por eso el evento guarda el antes y el despues.
    isScopeExpansion: false,
  });
}

function actionMap(accion: TreeAuditEvent['action']): ConfigChangeLog['action'] {
  switch (accion) {
    case 'crear-carpeta':
    case 'create-module':
      return 'create';
    case 'borrar-definitivamente':
      return 'delete';
    case 'mover':
      return 'move';
    default:
      return 'update';
  }
}

export interface FilterAudit {
  entityType?: ConfigChangeLog['entityType'];
  actorId?: string;
  /** Solo ampliaciones de ambito. Es la vista que el documento pide destacar (seccion 7). */
  onlyExpansions?: boolean;
  /** Solo movimientos en la organizacion general (4.1.2). */
  onlyMoves?: boolean;
}

/** Registro filtrable, mas reciente primero. */
export async function auditList(filtro: FilterAudit = {}): Promise<ConfigChangeLog[]> {
  return (await readEvents())
    .filter((e) => !filtro.entityType || e.entityType === filtro.entityType)
    .filter((e) => !filtro.actorId || e.actorId === filtro.actorId)
    .filter((e) => !filtro.onlyExpansions || e.isScopeExpansion)
    .filter((e) => !filtro.onlyMoves || e.action === 'move')
    .slice()
    .reverse();
}

/** Numero de ampliaciones de ambito vigentes. */
export async function expansionsCount(): Promise<number> {
  return (await readEvents()).filter((e) => e.isScopeExpansion).length;
}

/** Solo para pruebas. */
export async function clearAudit(): Promise<void> {
  await write(KEY_AUDIT, []);
}
