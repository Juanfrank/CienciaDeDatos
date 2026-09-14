import { ResourceList } from '../../../../src/components/admin/ResourceList';
import { resourcesOf } from '../../../../src/server/recursos';
import { sectionOf } from '../../../../src/components/admin/sections';
import { translator } from '../../../../src/server/locale';

export const dynamic = 'force-dynamic';

export default async function VisualizacionesPage() {
  const seccion = sectionOf('/admin/recursos/visualizaciones');
  const [t, filas] = await Promise.all([translator(), resourcesOf('visualizaciones')]);

  return (
    <section>
      <h2>{t('admin.resources.visualizations')}</h2>
      <p className="muted-text">{seccion?.desc}</p>
      <ResourceList rows={filas} familia="visualizaciones" t={t} />
    </section>
  );
}
