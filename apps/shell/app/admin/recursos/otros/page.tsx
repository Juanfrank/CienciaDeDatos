import { ICON_NAMES } from '@app/ui-components';
import { defaultIdentity } from '@app/design-tokens';
import { Icon } from '../../../../src/components/icons/Icon';
import { translator } from '../../../../src/server/locale';

export const dynamic = 'force-dynamic';

/**
 * Los recursos que no son objetos: se usan DENTRO de ellos.
 *
 * Los iconos se dibujan aqui de verdad, y no se listan por su nombre: un catalogo de iconos que
 * no ensena los iconos no sirve para elegir uno.
 */
export default async function OtrosRecursosPage() {
  const t = await translator();

  return (
    <section>
      <h2>{t('admin.recursos.otros')}</h2>
      <p className="muted-text">{t('admin.recursos.otros.intro')}</p>

      <h3>{t('admin.recursos.otros.iconos', { n: ICON_NAMES.length })}</h3>
      <ul className="icon-grid" data-testid="catalogo-iconos">
        {ICON_NAMES.map((nombre) => (
          <li key={nombre} data-testid={`icono-${nombre}`}>
            <Icon nombre={nombre} tamano={22} />
            <span className="muted-text">{nombre}</span>
          </li>
        ))}
      </ul>

      <h3>{t('admin.recursos.otros.imagenes')}</h3>
      <ul data-testid="catalogo-imagenes">
        <li>
          <img
            src={defaultIdentity.emblem.src}
            width={defaultIdentity.emblem.width}
            height={defaultIdentity.emblem.height}
            alt=""
          />
          <span className="muted-text">
            {' '}
            {t('admin.recursos.otros.emblema')} · {defaultIdentity.emblem.src}
          </span>
        </li>
      </ul>

      <h3>{t('admin.recursos.otros.geometrias')}</h3>
      <p className="muted-text" data-testid="sin-geometrias">
        {t('admin.recursos.otros.sinGeometrias')}
      </p>
    </section>
  );
}
