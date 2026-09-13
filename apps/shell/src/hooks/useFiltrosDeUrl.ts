'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

/** Estado de filtros en la URL — seccion 4.11. */
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

  /** Deja el campo con UN valor, o lo quita si el valor es vacio. */
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
    (path: string, filtros?: Record<string, string[]>) => {
      const params = new URLSearchParams();
      for (const [campo, valores] of Object.entries(filtros ?? {})) {
        for (const v of valores) params.append(campo, v);
      }
      const cadena = params.toString();
      // push, no replace: esto si es navegacion y debe poder deshacerse con "atras".
      router.push(cadena ? `${path}?${cadena}` : path);
    },
    [router],
  );

  return { valoresDe, alternar, fijar, limpiarCampo, limpiarTodo, navegarA, searchParams };
}
