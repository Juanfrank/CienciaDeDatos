import { ResourceList } from '../../../../src/components/admin/ResourceList';
import { resourcesOf } from '../../../../src/server/recursos';
import { sectionOf } from '../../../../src/components/admin/sections';
import { translator } from '../../../../src/server/locale';

export const dynamic = 'force-dynamic';

export default async function ElementosPage() {
  const seccion = sectionOf('/admin/recursos/elementos');
  const [t, filas] = await Promise.all([translator(), resourcesOf('elementos')]);

  return (
    <section>
      <h2>{t('admin.recursos.elementos')}</h2>
      <p className="muted-text">{seccion?.desc}</p>
      <ResourceList rows={filas} familia="elementos" t={t} />
    </section>
  );
}
