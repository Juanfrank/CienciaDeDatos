import Link from 'next/link';
import { notFound } from 'next/navigation';
import { usoDe } from '../../../../../src/server/recursos';
import { translator } from '../../../../../src/server/locale';
import { BumpModule } from '../../../../../src/components/admin/BumpModule';
import { BumpTodos } from '../../../../../src/components/admin/BumpTodos';
import type { Subida } from '../../../../../src/components/admin/bump';
import { paginaDeAdmin } from '../../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * En que modulos esta un recurso, y con que version cada uno — seccion 4.5.
 *
 * La tabla de recursos decia «12 usos» y ahi se acababa. Con eso no se decide nada: doce usos en
 * dos modulos que ya corren la ultima version no son lo mismo que doce en nueve anclados a una
 * version que se retira el mes que viene. Aqui cada fila es un modulo, con la version que fija.
 */
export default async function UsagePage({ params }: { params: Promise<{ id: string }> }) {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const { id } = await params;
  const [datos, t] = await Promise.all([usoDe(id), translator()]);
  if (!datos) notFound();

  const { objeto, ultima, uso } = datos;

  // Los modulos anclados a una version vieja de ESTE objeto. La referencia de cada mensaje es el
  // modulo: aqui todas las filas son el mismo objeto, y su nombre no distinguiria una de otra.
  const pendientes: Subida[] = uso.detalle
    .filter((d) => d.atrasada)
    .map((d) => ({
      slug: d.slug,
      objectId: objeto.objectId,
      nombre: d.name ?? d.slug,
      desde: d.version,
      hasta: ultima,
    }));

  return (
    <section>
      <h2>{t('admin.usage.title', { recurso: objeto.name })}</h2>
      <p className="muted-text">{t('admin.usage.intro')}</p>

      <p>
        <Link href="/admin/resources">← {t('admin.resources.title')}</Link>
      </p>

      <BumpTodos subidas={pendientes} testid={objeto.objectId} />

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
                        // La REFERENCIA del mensaje es el modulo, no el objeto: aqui todas las
                        // filas son el mismo objeto en modulos distintos, y repetir su nombre en
                        // cada mensaje no diria cual fue cual.
                        nombre={d.name ?? d.slug}
                        desde={d.version}
                        hasta={ultima}
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
