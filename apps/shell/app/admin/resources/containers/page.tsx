import { ResourceList } from '../../../../src/components/admin/ResourceList';
import { resourcesOf } from '../../../../src/server/recursos';
import { sectionOf } from '../../../../src/components/admin/sections';
import { translator } from '../../../../src/server/locale';
import { paginaDeAdmin } from '../../../../src/server/admin';

export const dynamic = 'force-dynamic';

export default async function ContenedoresPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const seccion = sectionOf('/admin/resources/containers');
  const [t, filas] = await Promise.all([translator(), resourcesOf('contenedores')]);

  return (
    <section>
      <h2>{t('admin.resources.containers')}</h2>
      <p className="muted-text">{seccion?.desc}</p>
      <ResourceList rows={filas} familia="contenedores" t={t} />
    </section>
  );
}
