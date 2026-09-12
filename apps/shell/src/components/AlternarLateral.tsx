'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ID_LATERAL } from './NavegacionPlegable';
import { Icono } from './iconos/Icono';

/**
 * Pliega y despliega el panel lateral desde la cabecera.
 *
 * El boton esta en el layout raiz y el panel en el de los modulos: son dos arboles de React
 * distintos y no comparten estado. En vez de montar un contexto que atraviese toda la
 * aplicacion, el boton escribe `data-lateral` en `<body>` y el CSS hace el resto. Es una sola
 * fuente de verdad —la del boton, que es quien tiene que anunciar `aria-expanded`— y funciona
 * igual sobre el arbol de modulos que sobre el menu de administracion.
 *
 * Solo se dibuja si en la pagina HAY panel. No es cosmetica: `aria-controls` que apunta a un
 * elemento inexistente es una violacion de `aria-valid-attr-value`, y un boton que no hace nada
 * es peor que ninguno. Por eso se comprueba en el cliente y se vuelve a comprobar en cada
 * navegacion.
 */

/** El mismo ancho que la media query del CSS. Si uno cambia, el otro tambien. */
export const CONSULTA_MOVIL = '(max-width: 640px)';

export function AlternarLateral() {
  const ruta = usePathname();
  const [hayPanel, setHayPanel] = useState(false);
  const [abierto, setAbierto] = useState(true);
  /*
   * Si la persona ya decidio, el ancho deja de opinar.
   *
   * Sin esto, cualquier `change` de la media query reabria el panel que se acababa de cerrar, y
   * no hace falta cruzar el umbral para que llegue uno: basta que el navegador reevalue las
   * metricas del dispositivo. El resultado era un boton que parecia no funcionar, porque el
   * panel volvia solo unas decimas despues.
   *
   * La regla es la que se espera de un control: el ancho fija el estado INICIAL, y a partir de
   * la primera pulsacion manda la pulsacion.
   */
  const decidido = useRef(false);

  useEffect(() => {
    setHayPanel(document.getElementById(ID_LATERAL) !== null);
  }, [ruta]);

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
    document.body.dataset.lateral = abierto ? 'visible' : 'oculto';
  }, [abierto]);

  if (!hayPanel) return null;

  return (
    <button
      type="button"
      className="cabecera__sandwich"
      aria-expanded={abierto}
      aria-controls={ID_LATERAL}
      aria-label={abierto ? 'Ocultar el panel de navegacion' : 'Mostrar el panel de navegacion'}
      data-testid="abrir-navegacion"
      onClick={() => {
        decidido.current = true;
        setAbierto((v) => !v);
      }}
    >
      <Icono nombre="sandwich" tamano={22} />
    </button>
  );
}
