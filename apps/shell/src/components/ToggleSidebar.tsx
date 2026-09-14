'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SIDEBAR_ID } from './CollapsibleNavigation';
import { Icon } from './icons/Icon';

/** Pliega y despliega el panel lateral desde la cabecera. */

/** El mismo ancho que la media query del CSS. Si uno cambia, el otro tambien. */
export const CONSULTA_MOVIL = '(max-width: 640px)';

export function ToggleSidebar() {
  const path = usePathname();
  const [hayPanel, setHayPanel] = useState(false);
  const [abierto, setAbierto] = useState(true);
  /*
   * Si la persona ya decidio, el ancho deja de opinar.
   */
  const decidido = useRef(false);

  useEffect(() => {
    setHayPanel(document.getElementById(SIDEBAR_ID) !== null);
  }, [path]);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOVIL);

    // El estado inicial depende del ancho, que en el servidor no se conoce. En movil el panel
    // ocupaba toda la parte de arriba y habia que pasar por el entero antes de llegar al modulo
    // que se venia a ver.
    const aplicar = (estrecha: boolean) => {
      if (decidido.current) return;
      setAbierto(!estrecha);
    };

    aplicar(consulta.matches);
    const alCambiar = (e: MediaQueryListEvent) => aplicar(e.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  useEffect(() => {
    document.body.dataset.sidebar = abierto ? 'visible' : 'oculto';
  }, [abierto]);

  if (!hayPanel) return null;

  return (
    <button
      type="button"
      className="header__sandwich"
      aria-expanded={abierto}
      aria-controls={SIDEBAR_ID}
      aria-label={abierto ? 'Ocultar el panel de navegacion' : 'Mostrar el panel de navegacion'}
      data-testid="abrir-navegacion"
      onClick={() => {
        decidido.current = true;
        setAbierto((v) => !v);
      }}
    >
      <Icon nombre="sandwich" tamano={22} />
    </button>
  );
}
