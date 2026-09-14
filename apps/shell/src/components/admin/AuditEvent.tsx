import type { ConfigChangeLog } from '@app/observability';

/** Una fila del registro de auditoria, en castellano. */

const ACTION: Record<ConfigChangeLog['action'], string> = {
  create: 'creo',
  update: 'modifico',
  delete: 'elimino',
  move: 'movio',
  'scope-expansion': 'amplio el ambito de',
  submit: 'envio a aprobacion',
  publish: 'publico',
  withdraw: 'retiro',
};

const ENTIDAD: Record<ConfigChangeLog['entityType'], string> = {
  team: 'el equipo',
  membership: 'la membresia de',
  'nav-node': 'el nodo',
  scope: 'el ambito',
  package: 'el paquete',
  role: 'el rol de',
  module: 'el modulo',
};

/** Fecha corta y legible. La hora importa: dos cambios del mismo dia se distinguen por ella. */
const cuando = (iso: string): string =>
  new Date(iso).toLocaleString('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export function AuditEvent({ evento }: { evento: ConfigChangeLog }) {
  return (
    <li className="log__row" data-ampliacion={evento.isScopeExpansion ? 'si' : undefined}>
      <span className="log__cuando">
        {/* `dateTime` lleva el valor exacto; el texto lleva el legible. */}
        <time dateTime={evento.timestamp}>{cuando(evento.timestamp)}</time>
      </span>
      <span className="log__que">
        <strong>{evento.actorId}</strong> {ACTION[evento.action] ?? evento.action}{' '}
        {ENTIDAD[evento.entityType] ?? evento.entityType} <code>{evento.entityId}</code>
      </span>
      {evento.isScopeExpansion ? (
        <span className="insignia insignia--error" data-testid="insignia-ampliacion">
          Ampliacion
        </span>
      ) : null}
      {/*
        La justificacion se ensena AQUI, no escondida tras un clic.
        Es la unica razon por la que una ampliacion se admite (§4.10.4): un registro que la
        guarda pero no la muestra obliga a abrir fila por fila justo las que mas se revisan.
      */}
      {evento.justification ? (
        <span className="log__motivo">{evento.justification}</span>
      ) : null}
    </li>
  );
}
