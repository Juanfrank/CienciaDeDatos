'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Estado de filtros en la URL — seccion 4.11.
 *
 * "Los filtros y selecciones activas se reflejan en la query string, de modo que la URL sea, en
 * todo momento, la representacion completa del estado visible de la pagina."
 *
 * De aqui sale tambien el filtrado cruzado de 4.4: seleccionar una categoria en un objeto es,
 * literalmente, anadir un filtro a la URL. No hay un estado paralelo que mantener sincronizado,
 * y por eso una seleccion es compartible y marcable por construccion.
 *
 * Historial: `replace` para ajustes incrementales de filtro y `push` solo para navegacion
 * deliberada, para que el boton "atras" no quede saturado de micro-cambios.
 */
export function useFiltrosDeUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const valoresDe = useCallback(
    (campo: string): string[] => searchParams.getAll(campo),
    [searchParams],
  );

  const comprometidos = searchParams.toString();

  /*
   * Lo ULTIMO que se pidio, aunque el enrutador todavia no lo haya comprometido.
   *
   * `searchParams` es el valor que React tenia cuando se creo el manejador, y `router.replace` no
   * lo actualiza de inmediato: ni el, ni `window.location`. Asi que si un segundo gesto llega
   * antes de que el primero se comprometa, su manejador parte de los parametros ANTERIORES,
   * escribe, y borra lo que el primero acababa de poner.
   *
   * Con un segmentador por objeto casi no se notaba: hacian falta dos clics en objetos distintos
   * en menos de lo que tarda un render. Con un panel de diez controles juntos, pulsar dos
   * seguidos es el gesto normal, y el primer filtro desaparecia sin dejar rastro.
   *
   * La referencia guarda lo pedido y se vacia en cuanto el enrutador comprometa algo —lo nuestro,
   * o una navegacion de fuera como el boton «atras», que tambien mueve `searchParams` y tiene que
   * ganar—.
   */
  const pedido = useRef<string | null>(null);
  useEffect(() => {
    pedido.current = null;
  }, [comprometidos]);

  const aplicar = useCallback(
    (mutar: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(pedido.current ?? comprometidos);
      mutar(params);
      const cadena = params.toString();
      pedido.current = cadena;
      // scroll:false evita que ajustar un filtro devuelva la pagina al principio.
      router.replace(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false });
    },
    [comprometidos, pathname, router],
  );

  const alternar = useCallback(
    (campo: string, valor: string) => {
      aplicar((params) => {
        const actuales = params.getAll(campo);
        params.delete(campo);
        const siguientes = actuales.includes(valor)
          ? actuales.filter((v) => v !== valor)
          : [...actuales, valor];
        for (const v of siguientes) params.append(campo, v);
      });
    },
    [aplicar],
  );

  /**
   * Deja el campo con UN valor, o lo quita si el valor es vacio.
   *
   * `alternar` sirve para seleccion multiple —pastillas, casillas—, donde pulsar de nuevo quita.
   * Un desplegable y una fecha no alternan: eligen. Con `alternar`, cambiar de fecha habria
   * dejado las dos en la URL.
   */
  const fijar = useCallback(
    (campo: string, valor: string) => {
      aplicar((params) => {
        params.delete(campo);
        if (valor !== '') params.append(campo, valor);
      });
    },
    [aplicar],
  );

  const limpiarCampo = useCallback(
    (campo: string) => {
      aplicar((params) => params.delete(campo));
    },
    [aplicar],
  );

  const limpiarTodo = useCallback(() => {
    // Tambien deja constancia de lo pedido: si no, un gesto inmediatamente posterior partiria de
    // los filtros que se acaban de quitar y los devolveria.
    pedido.current = '';
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  /** Drill-through (4.4): navegacion DELIBERADA a otro modulo llevando el contexto de filtros. */
  const navegarA = useCallback(
    (ruta: string, filtros?: Record<string, string[]>) => {
      const params = new URLSearchParams();
      for (const [campo, valores] of Object.entries(filtros ?? {})) {
        for (const v of valores) params.append(campo, v);
      }
      const cadena = params.toString();
      // push, no replace: esto si es navegacion y debe poder deshacerse con "atras".
      router.push(cadena ? `${ruta}?${cadena}` : ruta);
    },
    [router],
  );

  return { valoresDe, alternar, fijar, limpiarCampo, limpiarTodo, navegarA, searchParams };
}
