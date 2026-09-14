import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ModuleAccess } from '../../../../../src/components/admin/ModuleAccess';
import { accessToModule } from '../../../../../src/server/admin';
import { listUsers } from '../../../../../src/server/context';
import { modules } from '../../../../../src/server/moduleStore';
import { translator } from '../../../../../src/server/locale';

export const dynamic = 'force-dynamic';

/** Permisos de un modulo — secciones 4.10.6 y 4.10.8. */
export default async function ModulePermissionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [t, definiciones, usuarios] = await Promise.all([translator(), modules.list(), listUsers()]);

  const modulo = definiciones.find((m) => m.slug === slug);
  if (!modulo) notFound();

  return (
    <section>
      <h2>{t('admin.access.title', { modulo: modulo.name })}</h2>
      <p className="muted-text">{t('admin.access.intro')}</p>

      <p>
        <Link href="/admin/modules">← {t('admin.modules.title')}</Link>
      </p>

      <ModuleAccess
        slug={modulo.slug}
        acceso={await accessToModule(modulo.moduleId)}
        personas={usuarios
          .map((u) => ({ userId: u.userId, nombre: u.displayName ?? u.userId }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))}
      />
    </section>
  );
}
