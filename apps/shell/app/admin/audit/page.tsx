import { expansionsCount, auditList } from '../../../src/server/audit';
import { listUsers } from '../../../src/server/context';
import { translator } from '../../../src/server/locale';
import { paginaDeAdmin } from '../../../src/server/admin';

export const dynamic = 'force-dynamic';

/** Registro de auditoria — secciones 4.10.7 y 7. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const query = await searchParams;
  const onlyExpansions = query['onlyExpansions'] === '1';
  const onlyMoves = query['onlyMoves'] === '1';

  const eventos = await auditList({
    ...(onlyExpansions ? { onlyExpansions: true } : {}),
    ...(onlyMoves ? { onlyMoves: true } : {}),
  });
  const ampliaciones = await expansionsCount();

  /*
   * «Quien» es una persona, no una fila del almacen.
   *
   * La columna mostraba `actorId` en crudo —`u-admin`—, que es el identificador con el que el
   * gobierno guarda a alguien, no su nombre. Quien audita no tiene por que saberselos, y la
   * cabecera de la aplicacion lleva mostrando el nombre desde que existe `displayName`. Si el
   * directorio no trae nombre, se cae al identificador, que es lo que se veia antes.
   */
  const nombreDe = new Map((await listUsers()).map((u) => [u.userId, u.displayName ?? u.userId]));
  const t = await translator();

  return (
    <section>
      <h2>{t('admin.audit.title')}</h2>

      <p
        className={`aviso ${ampliaciones > 0 ? 'notice-atencion' : 'notice-ok'}`}
        data-testid="resumen-ampliaciones"
      >
        {t('admin.audit.expansions', { n: ampliaciones })}{' '}
        {ampliaciones === 0
          ? t('admin.audit.expansions.none')
          : t('admin.audit.expansions.some')}
      </p>

      <nav className="audit-filters" aria-label={t('admin.audit.filters')}>
        <a href="/admin/audit" data-testid="all-filter">
          {t('admin.audit.filter.all')}
        </a>
        <a href="/admin/audit?onlyExpansions=1" data-testid="filter-expansions">
          {t('admin.audit.filter.expansions')}
        </a>
        <a href="/admin/audit?onlyMoves=1" data-testid="filter-moves">
          {t('admin.audit.filter.moves')}
        </a>
      </nav>

      {eventos.length === 0 ? (
        <p className="muted-text" data-testid="audit-empty">
          {t('admin.audit.empty')}
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="audit-table">
            <thead>
              <tr>
                <th>{t('admin.audit.column.when')}</th>
                <th>{t('admin.audit.column.who')}</th>
                <th>{t('admin.audit.column.what')}</th>
                <th>{t('admin.audit.column.action')}</th>
                <th>{t('admin.audit.column.justification')}</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e, i) => (
                <tr key={i} className={e.isScopeExpansion ? 'es-ampliacion' : ''}>
                  <td>{new Date(e.timestamp).toLocaleString('es-DO')}</td>
                  <td>{nombreDe.get(e.actorId) ?? e.actorId}</td>
                  <td>
                    <code>{e.entityType}</code> {e.entityId}
                  </td>
                  <td>
                    {e.action}
                    {e.isScopeExpansion ? (
                      <span className="insignia badge--error">
                        {t('admin.audit.expansion')}
                      </span>
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
