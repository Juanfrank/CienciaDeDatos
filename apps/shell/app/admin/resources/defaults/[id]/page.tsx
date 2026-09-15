import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OBJECT_ICONS } from '@app/ui-components';
import { ResourceDefaults } from '../../../../../src/components/admin/ResourceDefaults';
import { objectRegistry } from '../../../../../src/server/context';
import {
  ICON_PREFIX,
  defaultPresentations,
  disabledResources,
} from '../../../../../src/server/catalogo';
import { translator } from '../../../../../src/server/locale';
import { paginaDeAdmin } from '../../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * La presentacion con la que sale de fabrica un objeto del catalogo — secciones 4.2, 4.3 y 4.5.
 *
 * El lapiz de la tabla de recursos llevaba a proponer una version, que es otra cosa: proponer es
 * pedir que cambie el OBJETO, y eso pasa por revision de pares y una version nueva (4.5). Esto no
 * toca el objeto. Fija con que formato nace cada uno que se coloque, que es un metadato de
 * gobierno y no codigo — la misma naturaleza que «este objeto ya no se ofrece».
 *
 * Sin esto, la decision de la institucion sobre como se ve un grafico no tenia donde vivir: se
 * reaplicaba a mano en cada modulo, y salia distinta segun quien la recordara.
 */
export default async function DefaultsPage({ params }: { params: Promise<{ id: string }> }) {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const { id } = await params;
  const [t, predeterminados, deshabilitados] = await Promise.all([
    translator(),
    defaultPresentations(),
    disabledResources(),
  ]);

  const definicion = objectRegistry.list().find((o) => o.objectId === id);
  const version = definicion ? objectRegistry.latest(definicion.objectId) : undefined;
  if (!definicion || !version) notFound();

  // La misma lista que ve el editor: un icono deshabilitado no se ofrece aqui tampoco, o el
  // predeterminado pondria en cada objeto nuevo justo el icono que se retiro.
  const iconos = OBJECT_ICONS.filter((nombre) => !deshabilitados.has(`${ICON_PREFIX}${nombre}`));

  return (
    <section>
      <h2>{t('admin.defaults.title', { recurso: definicion.name })}</h2>
      <p className="muted-text">{t('admin.defaults.intro')}</p>

      <p>
        <Link href="/admin/resources">← {t('admin.resources.title')}</Link>
      </p>

      <ResourceDefaults
        objectId={definicion.objectId}
        nombre={definicion.name}
        version={version.version}
        admitidas={version.presentation}
        iconos={iconos}
        inicial={predeterminados[definicion.objectId] ?? {}}
      />
    </section>
  );
}
