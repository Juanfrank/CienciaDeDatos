'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Si un elemento tiene mas contenido del que cabe.
 *
 * Existe por una razon de accesibilidad y no de estetica. Desde que el alto de un objeto lo manda
 * la rejilla y no su contenido, el cuerpo de la tarjeta puede desplazarse — y una region
 * desplazable TIENE que alcanzarse con el teclado (2.1.1): si solo se recorre con la rueda del
 * raton, la parte de abajo no existe para quien navega tabulando.
 *
 * Lo que no se puede hacer es poner una parada de tabulacion en todas las tarjetas por si acaso:
 * un modulo de doce objetos sumaria doce paradas que no llevan a ninguna parte. Asi que se mide,
 * y solo la recibe la que de verdad desborda.
 *
 * Se observa el tamano y no solo el montaje porque las dos cosas que provocan desbordamiento
 * ocurren despues: un filtro que cambia las filas de una tabla, y el propio redimensionado de la
 * ventana.
 */
export function useDesborda<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [desborda, setDesborda] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const medir = () => {
      // Un pixel de margen: los redondeos subpixel del navegador producen diferencias de 0,5 px
      // que no son desbordamiento real y harian aparecer y desaparecer la parada de tabulacion.
      setDesborda(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    };

    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    // El contenido puede cambiar sin que cambie la caja: una tabla con menos filas tras un filtro.
    const mutaciones = new MutationObserver(medir);
    mutaciones.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      observador.disconnect();
      mutaciones.disconnect();
    };
  }, []);

  return { ref, desborda };
}
