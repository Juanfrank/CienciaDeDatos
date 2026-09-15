'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Menu contextual de un objeto — el mismo en el visor y en el editor.
 *
 * Uno solo y no dos: las acciones cambian —leer en uno, editar en el otro— pero el comportamiento
 * es identico, y dos implementaciones del mismo gesto acaban divergiendo en cual tecla cierra, si
 * el menu se sale de la pantalla o si el foco vuelve a su sitio. Por eso lo que cambia se pasa
 * como datos: una lista de acciones.
 *
 * El boton derecho NO es la unica puerta. Un menu que solo se abre con el boton derecho no existe
 * para quien navega con teclado ni para quien usa un lector de pantalla, y 4.9 no admite eso: se
 * abre tambien con la tecla de menu contextual y con Shift+F10, que es lo que el sistema operativo
 * ya ensena. La tecla la escucha el contenedor, asi que vale con tener el foco en cualquier control
 * de la tarjeta.
 */
export interface AccionDeObjeto {
  id: string;
  etiqueta: string;
  /** Si lleva a otra pantalla. Se dibuja como enlace de verdad, no como boton que navega. */
  href?: string;
  onElegir?: () => void;
  disabled?: boolean;
  /** Destructiva: se separa del resto y se pinta como advertencia. */
  peligrosa?: boolean;
}

export interface PuntoDelMenu {
  x: number;
  y: number;
}

/**
 * El estado del menu de UN objeto.
 *
 * Vive en quien dibuja la tarjeta y no aqui dentro porque el mismo gesto —el boton derecho— lo
 * captura el contenedor, que es quien sabe sobre que objeto se hizo.
 */
export function useContextMenu() {
  const [punto, setPunto] = useState<PuntoDelMenu | null>(null);

  /*
   * Estables entre dibujos, con `useCallback`.
   *
   * Sin eso, `cerrar` era una funcion nueva en cada dibujo, y como es dependencia del efecto que
   * escucha fuera del menu, ese efecto se desmontaba y se volvia a montar sin parar: los oyentes
   * se quitaban justo entre el `mousedown` y el `click` de quien estaba pulsando una opcion.
   */
  /*
   * El punto se guarda en coordenadas de PAGINA, no de ventana.
   *
   * El menu se abria anclado al puntero y se cerraba al desplazar, y eso lo hacia desaparecer justo
   * al abrirlo: la hoja lleva `scroll-behavior: smooth`, asi que el desplazamiento que coloca el
   * objeto a la vista sigue corriendo DESPUES del clic. Guardado en coordenadas de pagina, el menu
   * se queda pegado a lo que abrio mientras la pagina se mueve, en vez de esfumarse.
   */
  const abrir = useCallback(
    (e: { clientX: number; clientY: number; preventDefault: () => void }) => {
      e.preventDefault();
      setPunto({ x: e.clientX + window.scrollX, y: e.clientY + window.scrollY });
    },
    [],
  );

  /*
   * Abierto desde el teclado no hay puntero, asi que el menu se ancla al elemento que tiene el
   * foco: lo contrario seria dibujarlo en la esquina de la pantalla, lejos de lo que se estaba
   * mirando, que es el mismo problema que tenia el globo de ayuda.
   */
  const abrirEnElFoco = useCallback((contenedor: HTMLElement | null) => {
    const activo = document.activeElement;
    const ancla = activo instanceof HTMLElement && contenedor?.contains(activo) ? activo : contenedor;
    const caja = ancla?.getBoundingClientRect();
    if (!caja) return;
    setPunto({ x: caja.left + window.scrollX, y: caja.bottom + window.scrollY });
  }, []);

  const cerrar = useCallback(() => setPunto(null), []);

  return { punto, abrir, abrirEnElFoco, cerrar };
}

/**
 * Engancha el boton derecho al contenedor, EN FASE DE CAPTURA.
 *
 * Con `onContextMenu` de React —que escucha al burbujear— el menu salia sobre la cabecera de la
 * tarjeta y no sobre el grafico: el lienzo de ECharts atiende el evento y no lo deja subir, asi que
 * justo encima del dato, que es donde cualquiera pulsa, no pasaba nada. En captura el contenedor lo
 * ve primero y ningun hijo puede quitarselo.
 */
export function useContextMenuOn(
  contenedor: React.RefObject<HTMLElement | null>,
  abrir: (e: { clientX: number; clientY: number; preventDefault: () => void }) => void,
  activo: boolean,
): void {
  useEffect(() => {
    const el = contenedor.current;
    if (!el || !activo) return;
    const alPulsar = (e: MouseEvent) => abrir(e);
    el.addEventListener('contextmenu', alPulsar, true);
    return () => el.removeEventListener('contextmenu', alPulsar, true);
  }, [contenedor, abrir, activo]);
}

/** Escucha la tecla de menu contextual dentro de un contenedor. */
export function useMenuKey(
  contenedor: React.RefObject<HTMLElement | null>,
  abrirEnElFoco: (el: HTMLElement | null) => void,
): void {
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) return;
      e.preventDefault();
      abrirEnElFoco(el);
    };
    el.addEventListener('keydown', alPulsar);
    return () => el.removeEventListener('keydown', alPulsar);
  }, [contenedor, abrirEnElFoco]);
}

export function ObjectMenu({
  punto,
  acciones,
  titulo,
  onCerrar,
}: {
  punto: PuntoDelMenu | null;
  acciones: AccionDeObjeto[];
  /** Para nombrar el menu: con varios objetos en pantalla, «Acciones» no dice de cual. */
  titulo: string;
  onCerrar: () => void;
}) {
  const menu = useRef<HTMLMenuElement>(null);
  const [sitio, setSitio] = useState<PuntoDelMenu | null>(null);

  /*
   * Se coloca DESPUES de medirse, para poder caber.
   *
   * Un menu abierto cerca del borde derecho o del inferior se sale de la pantalla y sus ultimas
   * opciones quedan donde nadie puede pulsarlas. Se mide y se desliza hacia dentro, que conserva la
   * cercania al puntero; saltar al otro lado la perderia.
   */
  useEffect(() => {
    if (!punto) {
      setSitio(null);
      return;
    }
    const colocar = () => {
      const caja = menu.current?.getBoundingClientRect();
      if (!caja) return;
      const hole = 8;
      // De pagina a ventana: el menu esta en `position: fixed`, y lo que se guardo es donde cayo
      // sobre el documento.
      const x = punto.x - window.scrollX;
      const y = punto.y - window.scrollY;
      setSitio({
        x: Math.max(hole, Math.min(x, window.innerWidth - caja.width - hole)),
        y: Math.max(hole, Math.min(y, window.innerHeight - caja.height - hole)),
      });
    };
    colocar();
    window.addEventListener('scroll', colocar, true);
    window.addEventListener('resize', colocar);
    return () => {
      window.removeEventListener('scroll', colocar, true);
      window.removeEventListener('resize', colocar);
    };
  }, [punto]);

  /* Se cierra con Escape y al pulsar fuera. Al desplazar NO se cierra: se mueve con la pagina. */
  useEffect(() => {
    if (!punto) return;
    const conTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    const fuera = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) onCerrar();
    };
    document.addEventListener('keydown', conTecla);
    document.addEventListener('mousedown', fuera);
    return () => {
      document.removeEventListener('keydown', conTecla);
      document.removeEventListener('mousedown', fuera);
    };
  }, [punto, onCerrar]);

  // El primer elemento toma el foco: abierto con el teclado, si no, no habria donde seguir.
  useEffect(() => {
    if (sitio) menu.current?.querySelector<HTMLElement>('[data-opcion]')?.focus();
  }, [sitio]);

  if (!punto || acciones.length === 0) return null;

  return (
    <menu
      ref={menu}
      className="menu-objeto"
      aria-label={titulo}
      /*
       * El menu no deja salir sus clics.
       *
       * En el editor el menu se dibuja dentro del lienzo, y el lienzo deselecciona al pulsar el
       * fondo: elegir «Configurar» seleccionaba el objeto y el mismo clic, al burbujear, lo
       * deseleccionaba. Lo que pasa dentro de un menu es del menu.
       */
      onClick={(e) => e.stopPropagation()}
      data-testid={`menu-${titulo}`}
      style={
        sitio
          ? { top: `${sitio.y}px`, left: `${sitio.x}px` }
          : { top: 0, left: 0, visibility: 'hidden' }
      }
    >
      {acciones.map((accion) => (
        <li key={accion.id} data-peligrosa={accion.peligrosa ? 'si' : undefined}>
          {accion.href ? (
            <Link
              href={accion.href}
              data-opcion=""
              data-testid={`menu-opcion-${accion.id}`}
              onClick={onCerrar}
            >
              {accion.etiqueta}
            </Link>
          ) : (
            <button
              type="button"
              data-opcion=""
              disabled={accion.disabled}
              data-testid={`menu-opcion-${accion.id}`}
              onClick={() => {
                accion.onElegir?.();
                onCerrar();
              }}
            >
              {accion.etiqueta}
            </button>
          )}
        </li>
      ))}
    </menu>
  );
}
