'use client';

import { useEffect, useRef } from 'react';

/**
 * Arbol de navegacion plegable en pantalla estrecha — seccion 4.9.
 *
 * El elemento es un `<details>` y no un boton con estado propio: el navegador ya trae el gesto,
 * el manejo de teclado y el anuncio de plegado/desplegado a un lector de pantalla. Lo unico que
 * decide este componente es el estado INICIAL, que depende del ancho y por tanto no se puede
 * saber en el servidor.
 *
 * El servidor lo emite ABIERTO a proposito. Si el JavaScript no llega a ejecutarse, el arbol
 * queda visible: es el comportamiento que habia antes de plegarlo —imperfecto en un movil, pero
 * utilizable— y nunca una navegacion que no se puede abrir. La degradacion cae del lado seguro.
 *
 * Se intento primero sin JavaScript, plegando con CSS. No funciona: los navegadores actuales
 * ocultan el contenido de un `<details>` cerrado a traves del pseudoelemento `::details-content`,
 * y la regla que lo anula en escritorio la borra el minificador por considerarla redundante —
 * `visible` es el valor inicial de la propiedad, aunque aqui no lo sea. Queda escrito para que
 * nadie lo vuelva a intentar por el mismo camino.
 */

/** El mismo ancho que la media query del CSS. Si uno cambia, el otro tambien. */
export const CONSULTA_MOVIL = '(max-width: 640px)';

export function NavegacionPlegable({
  resumen,
  children,
}: {
  resumen: string;
  children: React.ReactNode;
}) {
  const detalle = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOVIL);

    const aplicar = (estrecha: boolean) => {
      const el = detalle.current;
      if (!el) return;
      // Solo se toca el estado al CAMBIAR de tamano. Forzarlo en cada render cerraria el arbol
      // que la persona acaba de abrir.
      el.open = !estrecha;
    };

    aplicar(consulta.matches);
    const alCambiar = (e: MediaQueryListEvent) => aplicar(e.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return (
    <details className="lateral" ref={detalle} open>
      <summary className="lateral__resumen" data-testid="abrir-navegacion">
        {resumen}
      </summary>
      <div className="lateral__contenido">{children}</div>
    </details>
  );
}
