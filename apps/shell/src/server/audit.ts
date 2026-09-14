import type { ConfigChangeLog } from '@app/observability';
import { assertConfigChangeIsAuditable } from '@app/observability';
import type { TreeAuditEvent } from '@app/access-control';
import { KEY_AUDIT, escribir, readList } from './almacenCompartido';

/** Registro de auditoria de configuracion — secciones 4.10.7 y 7. */
/** Los eventos viven en el almacen COMPARTIDO. */
const leerEventos = (): Promise<ConfigChangeLog[]> => readList<ConfigChangeLog>(KEY_AUDIT);

export interface RegistrarCambioInput {
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
export async function registrarCambio(input: RegistrarCambioInput): Promise<ConfigChangeLog> {
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
  await escribir(KEY_AUDIT, [...(await leerEventos()), evento]);
  return evento;
}

/** Traduce un evento de dominio del arbol al formato del log de configuracion. */
export async function registrarEventoDeArbol(evento: TreeAuditEvent): Promise<ConfigChangeLog> {
  return registrarCambio({
    actorId: evento.actorId,
    entityType: 'nav-node',
    entityId: evento.nodeId,
    action: evento.action === 'mover' ? 'move' : mapearAccion(evento.action),
    ...(evento.scopeBefore ? { before: evento.scopeBefore } : {}),
    ...(evento.scopeAfter ? { after: evento.scopeAfter } : {}),
    // Un movimiento NO es una ampliacion por si mismo: puede restringir igual que ampliar. Lo
    // que hace es cambiar el ambito heredado, y por eso el evento guarda el antes y el despues.
    isScopeExpansion: false,
  });
}

function mapearAccion(accion: TreeAuditEvent['action']): ConfigChangeLog['action'] {
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
  soloAmpliaciones?: boolean;
  /** Solo movimientos en la organizacion general (4.1.2). */
  soloMovimientos?: boolean;
}

/** Registro filtrable, mas reciente primero. */
export async function listarAuditoria(filtro: FilterAudit = {}): Promise<ConfigChangeLog[]> {
  return (await leerEventos())
    .filter((e) => !filtro.entityType || e.entityType === filtro.entityType)
    .filter((e) => !filtro.actorId || e.actorId === filtro.actorId)
    .filter((e) => !filtro.soloAmpliaciones || e.isScopeExpansion)
    .filter((e) => !filtro.soloMovimientos || e.action === 'move')
    .slice()
    .reverse();
}

/** Numero de ampliaciones de ambito vigentes. */
export async function contarAmpliaciones(): Promise<number> {
  return (await leerEventos()).filter((e) => e.isScopeExpansion).length;
}

/** Solo para pruebas. */
export async function clearAudit(): Promise<void> {
  await escribir(KEY_AUDIT, []);
}
