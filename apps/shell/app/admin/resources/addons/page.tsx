import { ResourceList } from '../../../../src/components/admin/ResourceList';
import { resourcesOf } from '../../../../src/server/recursos';
import { sectionOf } from '../../../../src/components/admin/sections';
import { translator } from '../../../../src/server/locale';

export const dynamic = 'force-dynamic';

export default async function ComplementosPage() {
  const seccion = sectionOf('/admin/resources/addons');
  const [t, filas] = await Promise.all([translator(), resourcesOf('complementos')]);

  return (
    <section>
      <h2>{t('admin.resources.addons')}</h2>
      <p className="muted-text">{seccion?.desc}</p>
      <ResourceList rows={filas} familia="complementos" t={t} />
    </section>
  );
}
