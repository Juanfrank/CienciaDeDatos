import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listUsers } from '../../../../../src/server/context';
import { modules, SEMILLA } from '../../../../../src/server/moduleStore';
import { RestoreVersion } from '../../../../../src/components/admin/RestoreVersion';
import { translator } from '../../../../../src/server/locale';
import { paginaDeAdmin } from '../../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * Lo que estuvo publicado de un modulo, y desde cuando — seccion 4.5.
 *
 * El permiso lo pone el `layout.tsx` del panel, que corta a quien no administra antes de dibujar
 * nada. Esta pagina lee del almacen directamente en el servidor, sin pasar por la API: es la
 * misma lectura, sin un viaje de ida y vuelta que no anade nada.
 */
export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const { slug } = await params;
  const modulo = await modules.bySlug(slug);
  if (!modulo) notFound();

  const [historial, personas, t] = await Promise.all([
    modules.history(modulo.moduleId),
    listUsers(),
    translator(),
  ]);
  /*
   * Quien publico. La semilla no es una persona, y por eso no se busca en el directorio: poner
   * ahi un nombre de usuario seria atribuirle a alguien un acto que no hizo.
   */
  const nombreDe = (id: string) =>
    id === SEMILLA ? t('admin.history.bySystem') : (personas.find((u) => u.userId === id)?.displayName ?? id);

  return (
    <section>
      <h2>{t('admin.history.title', { modulo: modulo.name })}</h2>
      <p className="muted-text">{t('admin.history.intro')}</p>

      <p>
        <Link href="/admin/modules">← {t('admin.modules.title')}</Link>
        {' · '}
        <Link href={`/editor/${modulo.slug}`}>{t('action.edit')}</Link>
        {' · '}
        <Link href={`/m/${modulo.slug}`}>{t('action.view')}</Link>
      </p>

      {historial.length === 0 ? (
        <p className="muted-text" data-testid="history-empty">
          {t('admin.history.empty')}
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="history-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.history.column.version')}</th>
                <th scope="col">{t('admin.history.column.published')}</th>
                <th scope="col">{t('admin.history.column.by')}</th>
                <th scope="col">{t('admin.modules.column.pages')}</th>
                <th scope="col">{t('admin.modules.column.objects')}</th>
                <th scope="col">{t('admin.history.column.action')}</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((v) => {
                const vigente = v.version === modulo.version;
                return (
                  <tr key={v.version} data-testid={`history-v${v.version}`}>
                    <th scope="row">
                      v{v.version}
                      {vigente ? (
                        <span className="insignia" data-testid={`history-vigente-${v.version}`}>
                          {' '}
                          {t('admin.history.current')}
                        </span>
                      ) : null}
                      {v.restoredFrom === undefined ? null : (
                        <span className="muted-text">
                          {' · '}
                          {t('admin.history.restoredFrom', { version: v.restoredFrom })}
                        </span>
                      )}
                    </th>
                    <td>
                      <time dateTime={v.publishedAt}>
                        {new Date(v.publishedAt).toLocaleString('es-DO')}
                      </time>
                    </td>
                    <td>{nombreDe(v.publishedBy)}</td>
                    <td>{v.definition.pages.length}</td>
                    <td>
                      {v.definition.pages.reduce((n, p) => n + p.items.length, 0)}
                    </td>
                    <td>
                      {/*
                        Ver y restaurar, en ese orden.
                        Solo se ofrecia restaurar, que es publicar: para saber si una version
                        servia habia que ponerla en produccion y juzgar despues. Mirar tiene que
                        poder hacerse sin consecuencias, y la que las tiene va detras.
                      */}
                      <span className="fila-acciones">
                        <Link
                          href={`/admin/modules/${modulo.slug}/history/${v.version}`}
                          className="button-link"
                          data-testid={`ver-v${v.version}`}
                        >
                          {t('action.view')}
                        </Link>
                        {vigente ? null : (
                          <RestoreVersion slug={modulo.slug} version={v.version} />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
