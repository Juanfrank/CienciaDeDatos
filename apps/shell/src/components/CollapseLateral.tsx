'use client';

import { Icon } from './icons/Icon';
import { useTranslator } from './Locale';
import { SIDEBAR_ID } from './CollapsibleNavigation';
import { sidebarToggle, useSidebar } from './sidebarState';

/**
 * Colapsa y despliega el navegador de MODULOS, desde el propio navegador.
 *
 * Hace lo mismo que el sandwich de la cabecera, y a proposito: son dos puertas al mismo estado,
 * no dos estados. La de la cabecera esta donde se busca cuando el panel no se ve; esta esta donde
 * se mira cuando si se ve, que es el momento en que uno decide que estorba.
 *
 * Al pie y no arriba, igual que en el navegador de paginas: arriba compite con el primer modulo
 * del arbol, que es a donde va casi todo el mundo. Y con rotulo ademas del icono — un par de
 * flechas solo se entiende despues de pulsarlas. Colapsado queda el icono, que es lo unico que
 * cabe en el carril, y el rotulo sigue ahi para quien no lo ve.
 */
export function CollapseLateral() {
  const estado = useSidebar();
  const t = useTranslator();
  const abierto = estado === 'visible';

  return (
    <button
      type="button"
      className="sidebar__plegar"
      aria-expanded={abierto}
      aria-controls={SIDEBAR_ID}
      data-testid="lateral-plegar"
      onClick={sidebarToggle}
    >
      <Icon nombre={abierto ? 'plegar-panel' : 'desplegar-panel'} tamano={18} />
      <span className={abierto ? '' : 'visually-hidden'}>
        {abierto ? t('nav.collapse') : t('nav.expand')}
      </span>
    </button>
  );
}
