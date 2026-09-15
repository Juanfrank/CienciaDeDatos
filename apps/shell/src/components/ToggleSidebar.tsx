'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SIDEBAR_ID } from './CollapsibleNavigation';
import { Icon } from './icons/Icon';
import { sidebarSet, sidebarToggle, useSidebar } from './sidebarState';

/** Pliega y despliega el panel lateral desde la cabecera. */

/** El mismo ancho que la media query del CSS. Si uno cambia, el otro tambien. */
export const MOBILE_QUERY = '(max-width: 640px)';

export function ToggleSidebar() {
  const path = usePathname();
  const [hayPanel, setHayPanel] = useState(false);
  /*
   * El estado vive FUERA del componente, en `sidebarState`.
   *
   * Lo comparte con el boton al pie del propio panel, que hace lo mismo. Teniendolo aqui, plegar
   * desde abajo dejaba a este diciendo `aria-expanded="true"` sobre un panel colapsado — y eso es
   * lo que un lector de pantalla lee en voz alta.
   */
  const abierto = useSidebar() === 'visible';
  /*
   * Si la persona ya decidio, el ancho deja de opinar.
   */
  const decidido = useRef(false);

  useEffect(() => {
    setHayPanel(document.getElementById(SIDEBAR_ID) !== null);
  }, [path]);

  useEffect(() => {
    const consulta = window.matchMedia(MOBILE_QUERY);

    // El estado inicial depende del ancho, que en el servidor no se conoce. En movil el panel
    // ocupaba toda la parte de arriba y habia que pasar por el entero antes de llegar al modulo
    // que se venia a ver.
    const apply = (estrecha: boolean) => {
      if (decidido.current) return;
      sidebarSet(estrecha ? 'oculto' : 'visible');
    };

    apply(consulta.matches);
    const changeTo = (e: MediaQueryListEvent) => apply(e.matches);
    consulta.addEventListener('change', changeTo);
    return () => consulta.removeEventListener('change', changeTo);
  }, []);

  if (!hayPanel) return null;

  return (
    <button
      type="button"
      className="header__sandwich"
      aria-expanded={abierto}
      aria-controls={SIDEBAR_ID}
      aria-label={abierto ? 'Ocultar el panel de navegacion' : 'Mostrar el panel de navegacion'}
      data-testid="open-navigation"
      onClick={() => {
        decidido.current = true;
        sidebarToggle();
      }}
    >
      <Icon nombre="sandwich" tamano={22} />
    </button>
  );
}
