import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ModuleSettings } from '../../../../../src/components/admin/ModuleSettings';
import { availableDimensions } from '../../../../../src/server/admin';
import { modules } from '../../../../../src/server/moduleStore';
import { translator } from '../../../../../src/server/locale';

export const dynamic = 'force-dynamic';

/**
 * Configuracion de un modulo — secciones 4.1 y 4.11.
 *
 * Se llega desde la tuerca de su fila en el arbol, que es donde alguien se pregunta por estas
 * cosas: mirando la lista y viendo que un modulo se llama como no debe o que ofrece algo que no
 * deberia ofrecer.
 */
export default async function ModuleSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [t, definiciones, dimensiones] = await Promise.all([
    translator(),
    modules.list(),
    availableDimensions(),
  ]);

  const modulo = definiciones.find((m) => m.slug === slug);
  if (!modulo) notFound();

  return (
    <section>
      <h2>{t('admin.settings.title', { modulo: modulo.name })}</h2>
      <p className="muted-text">{t('admin.settings.intro')}</p>

      <p>
        <Link href="/admin/modules">← {t('admin.modules.title')}</Link>
      </p>

      <ModuleSettings
        slug={modulo.slug}
        campos={dimensiones.map((d) => d.key)}
        inicial={{
          name: modulo.name,
          slug: modulo.slug,
          description: modulo.description ?? '',
          options: modulo.options ?? {},
          defaultFilters: modulo.defaultFilters ?? [],
          navigator: modulo.navigator ?? null,
          pages: modulo.pages.map((p) => ({
            pageId: p.pageId,
            slug: p.slug,
            name: p.name,
            icon: p.icon ?? '',
          })),
        }}
      />
    </section>
  );
}
