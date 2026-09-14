import Link from 'next/link';
import { notFound } from 'next/navigation';
import { usoDe } from '../../../../../src/server/recursos';
import { translator } from '../../../../../src/server/locale';
import { BumpModule } from '../../../../../src/components/admin/BumpModule';

export const dynamic = 'force-dynamic';

/**
 * En que modulos esta un recurso, y con que version cada uno — seccion 4.5.
 *
 * La tabla de recursos decia «12 usos» y ahi se acababa. Con eso no se decide nada: doce usos en
 * dos modulos que ya corren la ultima version no son lo mismo que doce en nueve anclados a una
 * version que se retira el mes que viene. Aqui cada fila es un modulo, con la version que fija.
 */
export default async function UsagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [datos, t] = await Promise.all([usoDe(id), translator()]);
  if (!datos) notFound();

  const { objeto, ultima, uso } = datos;

  return (
    <section>
      <h2>{t('admin.usage.title', { recurso: objeto.name })}</h2>
      <p className="muted-text">{t('admin.usage.intro')}</p>

      <p>
        <Link href="/admin/resources">← {t('admin.resources.title')}</Link>
      </p>

      {uso.detalle.length === 0 ? (
        <p className="muted-text" data-testid="usage-empty">
          {t('admin.usage.empty')}
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="usage-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.usage.column.module')}</th>
                <th scope="col">{t('admin.usage.column.pinned')}</th>
                <th scope="col">{t('admin.usage.column.instances')}</th>
                <th scope="col">{t('admin.resources.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {uso.detalle.map((d) => (
                <tr key={`${d.moduleId}@${d.version}`} data-testid={`uso-${d.slug}-${d.version}`}>
                  <th scope="row">
                    <Link href={`/editor/${d.slug}`}>{d.name}</Link>
                    <span className="muted-text"> /m/{d.slug}</span>
                  </th>
                  <td>
                    v{d.version}{' '}
                    {d.atrasada ? (
                      <span className="insignia badge--error">{t('admin.usage.behind')}</span>
                    ) : (
                      <span className="insignia">{t('admin.usage.latest')}</span>
                    )}
                  </td>
                  <td>{d.instancias}</td>
                  <td>
                    {d.atrasada ? (
                      <BumpModule
                        slug={d.slug}
                        objectId={objeto.objectId}
                        hasta={ultima}
                        etiquetas={{
                          subir: t('admin.resources.action.bump'),
                          aviso: t('admin.bump.warn', { desde: d.version, hasta: ultima }),
                          confirmar: t('admin.bump.confirm', { hasta: ultima }),
                          subiendo: t('admin.bump.doing'),
                          cancelar: t('action.cancel'),
                          hecho: (n) => t('admin.bump.done', { n, hasta: ultima }),
                          conserva: (claves) => t('admin.bump.kept', { claves }),
                          nuevas: (claves) => t('admin.bump.new', { claves }),
                          retiradas: (claves) => t('admin.bump.dropped', { claves }),
                          fallo: t('admin.bump.failed'),
                        }}
                      />
                    ) : (
                      <span className="muted-text">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
