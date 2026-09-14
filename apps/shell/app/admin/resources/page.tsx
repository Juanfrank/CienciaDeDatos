import { sectionOf } from '../../../src/components/admin/sections';
import { translator } from '../../../src/server/locale';

export const dynamic = 'force-dynamic';

export default async function RecursosPage() {
  const seccion = sectionOf('/admin/resources');
  const t = await translator();

  return (
    <section>
      <h2>{t('admin.resources.title')}</h2>
      <p className="muted-text">{seccion?.desc}</p>
    </section>
  );
}
