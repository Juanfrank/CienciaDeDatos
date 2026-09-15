'use client';

import { useSyncExternalStore } from 'react';

/**
 * Si el navegador de modulos esta desplegado, y quien lo dice.
 *
 * Hay DOS controles que lo mueven —el sandwich de la cabecera y el boton al pie del propio
 * navegador— y viven en subarboles distintos: uno cuelga del encabezado y el otro del panel. Con
 * el estado dentro de cualquiera de los dos, el otro se entera por casualidad o no se entera: se
 * colapsaba con el de abajo y el sandwich seguia diciendo `aria-expanded="true"`, que es
 * exactamente lo que un lector de pantalla lee en voz alta.
 *
 * Un contexto habria obligado a envolver la aplicacion entera en un proveedor para dos botones.
 * Esto es un almacen de modulo con `useSyncExternalStore`: los dos leen lo mismo, los dos
 * escriben en el mismo sitio, y el atributo del `<body>` —que es lo que el CSS mira— se escribe
 * en un solo lugar en vez de en cada componente que opine.
 */

export type SidebarState = 'visible' | 'oculto';

const oyentes = new Set<() => void>();
let estado: SidebarState = 'visible';

export const sidebarRead = (): SidebarState => estado;

/** En el servidor no hay `<body>` que mirar: se dibuja desplegado, que es como llega el HTML. */
const enElServidor = (): SidebarState => 'visible';

export function sidebarSubscribe(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function sidebarSet(siguiente: SidebarState): void {
  if (siguiente === estado) return;
  estado = siguiente;
  // El atributo del `<body>` es lo que el CSS mira. Se escribe aqui y en ningun otro sitio.
  if (typeof document !== 'undefined') document.body.dataset.sidebar = siguiente;
  for (const oyente of [...oyentes]) oyente();
}

export const sidebarToggle = (): void => sidebarSet(estado === 'visible' ? 'oculto' : 'visible');

/** El estado, para un componente de cliente. */
export function useSidebar(): SidebarState {
  return useSyncExternalStore(sidebarSubscribe, sidebarRead, enElServidor);
}
