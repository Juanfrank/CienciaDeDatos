import Link from 'next/link';
import { defaultIdentity } from '@app/design-tokens';
import { Icon } from '../../../../src/components/icons/Icon';
import { AssetTable } from '../../../../src/components/admin/AssetTable';
import { iconRows } from '../../../../src/server/recursos';
import { IMAGE_PREFIX, disabledResources } from '../../../../src/server/catalogo';
import type { AssetRow } from '../../../../src/server/recursos';
import { translator } from '../../../../src/server/locale';
import { paginaDeAdmin } from '../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * Los recursos que no son objetos: se usan DENTRO de ellos.
 *
 * En TABLA, como el resto del catalogo. Era una rejilla de fichas —bien para elegir un icono, mal
 * para gobernarlo—: no habia donde poner quien lo usa, ni el estado, ni una accion. La vista
 * sigue dibujando el icono de verdad, porque un catalogo de iconos que no ensena los iconos no
 * sirve para elegir ninguno; lo que se anade es todo lo demas.
 */
export default async function OtrosRecursosPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const [t, iconos, deshabilitados] = await Promise.all([
    translator(),
    iconRows(),
    disabledResources(),
  ]);

  // La imagen institucional es una sola y vive en `design-tokens`. Se dibuja por el mismo camino
  // que los iconos para que el dia que haya dos no haya que inventar una segunda pantalla.
  const emblema = defaultIdentity.emblem;
  const imagenes: AssetRow[] = [
    {
      id: `${IMAGE_PREFIX}${emblema.src}`,
      nombre: emblema.src,
      uso: { catalogo: [t('admin.resources.other.emblem')], modulos: [], total: 1 },
      disabled: deshabilitados.has(`${IMAGE_PREFIX}${emblema.src}`),
      seleccionable: false,
    },
  ];

  return (
    <section>
      <h2>{t('admin.resources.other')}</h2>
      <p className="muted-text">{t('admin.resources.other.intro')}</p>

      <p>
        <Link href="/admin/resources/proposals" className="pastilla" data-testid="add-otros">
          {t('admin.resources.add')}
        </Link>
      </p>

      <h3>{t('admin.resources.other.icons', { n: iconos.length })}</h3>
      <p className="muted-text">{t('admin.assets.icons.intro')}</p>
      <AssetTable
        familia="iconos"
        filas={iconos}
        t={t}
        vista={(fila) => <Icon nombre={fila.nombre as Parameters<typeof Icon>[0]['nombre']} tamano={22} />}
      />

      <h3>{t('admin.resources.other.images')}</h3>
      <p className="muted-text">{t('admin.assets.images.intro')}</p>
      <AssetTable
        familia="imagenes"
        filas={imagenes}
        t={t}
        vista={() => (
          <img src={emblema.src} width={emblema.width} height={emblema.height} alt="" />
        )}
      />

      <h3>{t('admin.resources.other.geometries')}</h3>
      <p className="muted-text">{t('admin.assets.geometries.intro')}</p>
      <AssetTable familia="geometrias" filas={[]} t={t} vista={() => null} />
    </section>
  );
}
