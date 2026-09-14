import Link from 'next/link';
import type { MessageKey } from '@app/i18n';
import { SectionIndex } from '../../../src/components/admin/SectionIndex';
import { sectionOf } from '../../../src/components/admin/sections';
import { modules } from '../../../src/server/moduleStore';
import { translator } from '../../../src/server/locale';

export const dynamic = 'force-dynamic';

const ESTADO: Record<string, MessageKey> = {
  borrador: 'admin.modules.status.draft',
  'pendiente-de-aprobacion': 'admin.modules.status.pending',
  publicado: 'admin.modules.status.published',
};

/** Los modulos vigentes, su version y donde se editan — secciones 4.1 y 4.2. */
export default async function ModulosPage() {
  const seccion = sectionOf('/admin/modules');
  const [t, definiciones] = await Promise.all([
    translator(),
    modules.list().then((lista) => [...lista].sort((a, b) => a.name.localeCompare(b.name, 'es'))),
  ]);
  const esperando = definiciones.filter((m) => m.status === 'pendiente-de-aprobacion');

  return (
    <section>
      <h2>{t('admin.modules.title')}</h2>
      <p className="muted-text">{seccion?.desc}</p>

      <SectionIndex sections={seccion?.hijas ?? []} />

      {/*
        Lo que espera una decision va PRIMERO y aparte.
        En una lista ordenada por nombre, un modulo propuesto hace tres semanas queda entre dos
        publicados y no lo ve nadie.
      */}
      {esperando.length > 0 ? (
        <div className="notice-atencion" data-testid="modulos-esperando">
          {t('admin.modules.awaiting', {
            n: esperando.length,
            nombres: t.lista(esperando.map((m) => m.name)),
          })}
        </div>
      ) : null}

      <h3>{t('admin.modules.current', { n: definiciones.length })}</h3>
      <table className="tabla" data-testid="tabla-modulos">
        <thead>
          <tr>
            <th scope="col">{t('admin.modules.column.module')}</th>
            <th scope="col">{t('admin.modules.column.status')}</th>
            <th scope="col">{t('admin.modules.column.version')}</th>
            <th scope="col">{t('admin.modules.column.pages')}</th>
            <th scope="col">{t('admin.modules.column.objects')}</th>
            <th scope="col">{t('admin.modules.column.author')}</th>
          </tr>
        </thead>
        <tbody>
          {definiciones.map((m) => (
            <tr key={m.moduleId} data-testid={`modulo-${m.slug}`}>
              <th scope="row">
                <Link href={`/editor/${m.slug}`}>{m.name}</Link>
                <span className="muted-text"> /m/{m.slug}</span>
              </th>
              <td>{ESTADO[m.status] ? t(ESTADO[m.status] as MessageKey) : m.status}</td>
              <td>v{m.version}</td>
              <td>{m.pages.length}</td>
              <td>{m.pages.reduce((total, p) => total + p.items.length, 0)}</td>
              <td>{m.ownerUserId ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="muted-text">
        {t('admin.modules.footer')} <Link href="/editor">{t('admin.modules.footer.link')}</Link>
      </p>
    </section>
  );
}
