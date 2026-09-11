import type { ConfigChangeLog } from '@app/observability';
import { assertConfigChangeIsAuditable } from '@app/observability';
import type { TreeAuditEvent } from '@app/access-control';

/**
 * Registro de auditoria de configuracion — secciones 4.10.7 y 7.
 *
 * Los cambios son EVENTOS VERSIONADOS, no sobrescritura silenciosa: se guarda el estado anterior
 * y el nuevo, de modo que la configuracion previa nunca se pierde.
 *
 * Las ampliaciones de ambito llevan marca propia para poder mostrarse destacadas, no mezcladas
 * indistintamente con el resto de cambios. El documento es explicito en que su numero deberia
 * tender a cero y que un numero creciente es señal de gobierno de RLS deteriorandose.
 */
const eventos: ConfigChangeLog[] = ((globalThis as Record<string, unknown>)['__auditoria'] ??=
  []) as ConfigChangeLog[];

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

/**
 * Registra un cambio de configuracion.
 *
 * Pasa SIEMPRE por `assertConfigChangeIsAuditable`, que lanza si una ampliacion de ambito llega
 * sin justificacion. Esa funcion existia desde B.6 pero hasta ahora no guardaba nada, porque no
 * habia ninguna superficie desde la que configurar un ambito. Esta es esa superficie.
 */
export function registrarCambio(input: RegistrarCambioInput): ConfigChangeLog {
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
  eventos.push(evento);
  return evento;
}

/** Traduce un evento de dominio del arbol al formato del log de configuracion. */
export function registrarEventoDeArbol(evento: TreeAuditEvent): ConfigChangeLog {
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
    case 'crear-modulo':
      return 'create';
    case 'borrar-definitivamente':
      return 'delete';
    case 'mover':
      return 'move';
    default:
      return 'update';
  }
}

export interface FiltroAuditoria {
  entityType?: ConfigChangeLog['entityType'];
  actorId?: string;
  /** Solo ampliaciones de ambito. Es la vista que el documento pide destacar (seccion 7). */
  soloAmpliaciones?: boolean;
  /** Solo movimientos en la organizacion general (4.1.2). */
  soloMovimientos?: boolean;
}

/** Registro filtrable, mas reciente primero. */
export function listarAuditoria(filtro: FiltroAuditoria = {}): ConfigChangeLog[] {
  return eventos
    .filter((e) => !filtro.entityType || e.entityType === filtro.entityType)
    .filter((e) => !filtro.actorId || e.actorId === filtro.actorId)
    .filter((e) => !filtro.soloAmpliaciones || e.isScopeExpansion)
    .filter((e) => !filtro.soloMovimientos || e.action === 'move')
    .slice()
    .reverse();
}

/**
 * Numero de ampliaciones de ambito vigentes.
 *
 * Metrica de salud de gobierno, no de actividad: deberia tender a cero, y una tendencia
 * creciente indica que el modelo de RLS se esta relajando por acumulacion de excepciones.
 */
export function contarAmpliaciones(): number {
  return eventos.filter((e) => e.isScopeExpansion).length;
}

/** Solo para pruebas. */
export function limpiarAuditoria(): void {
  eventos.length = 0;
}
