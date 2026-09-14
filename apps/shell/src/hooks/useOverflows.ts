'use client';

import { useEffect, useRef, useState } from 'react';

/** Si un elemento tiene mas contenido del que cabe. */
export function useOverflows<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflows, setDesborda] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const resize = () => {
      // Un pixel de margen: los redondeos subpixel del navegador producen diferencias de 0,5 px
      // que no son desbordamiento real y harian aparecer y desaparecer la parada de tabulacion.
      setDesborda(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    };

    resize();
    const observador = new ResizeObserver(resize);
    observador.observe(el);
    // El contenido puede cambiar sin que cambie la caja: una tabla con menos filas tras un filtro.
    const mutaciones = new MutationObserver(resize);
    mutaciones.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      observador.disconnect();
      mutaciones.disconnect();
    };
  }, []);

  return { ref, overflows };
}
