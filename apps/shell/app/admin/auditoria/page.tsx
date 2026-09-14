import { expansionsCount, auditList } from '../../../src/server/audit';

export const dynamic = 'force-dynamic';

/** Registro de auditoria — secciones 4.10.7 y 7. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const onlyExpansions = query['onlyExpansions'] === '1';
  const onlyMoves = query['onlyMoves'] === '1';

  const eventos = await auditList({
    ...(onlyExpansions ? { onlyExpansions: true } : {}),
    ...(onlyMoves ? { onlyMoves: true } : {}),
  });
  const ampliaciones = await expansionsCount();

  return (
    <section>
      <h2>Auditoria de configuracion</h2>

      <p
        className={`aviso ${ampliaciones > 0 ? 'notice-atencion' : 'notice-ok'}`}
        data-testid="resumen-ampliaciones"
      >
        <strong>{ampliaciones}</strong> ampliacion(es) de ambito vigentes.{' '}
        {ampliaciones === 0
          ? 'Es el valor deseable.'
          : 'Deberia tender a cero: un numero creciente indica que el modelo de RLS se relaja por acumulacion de excepciones.'}
      </p>

      <nav className="audit-filters" aria-label="Filtros del registro">
        <a href="/admin/auditoria" data-testid="all-filter">Todos</a>
        <a href="/admin/auditoria?onlyExpansions=1" data-testid="filtro-ampliaciones">
          Solo ampliaciones
        </a>
        <a href="/admin/auditoria?onlyMoves=1" data-testid="filtro-movimientos">
          Solo movimientos
        </a>
      </nav>

      {eventos.length === 0 ? (
        <p className="muted-text" data-testid="auditoria-vacia">
          Sin cambios registrados con este filtro.
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="audit-table">
            <thead>
              <tr>
                <th>Cuando</th>
                <th>Quien</th>
                <th>Que</th>
                <th>Accion</th>
                <th>Justificacion</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e, i) => (
                <tr key={i} className={e.isScopeExpansion ? 'es-ampliacion' : ''}>
                  <td>{new Date(e.timestamp).toLocaleString('es-DO')}</td>
                  <td>{e.actorId}</td>
                  <td>
                    <code>{e.entityType}</code> {e.entityId}
                  </td>
                  <td>
                    {e.action}
                    {e.isScopeExpansion ? (
                      <span className="insignia insignia--error">Ampliacion</span>
                    ) : null}
                  </td>
                  <td>{e.justification ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
