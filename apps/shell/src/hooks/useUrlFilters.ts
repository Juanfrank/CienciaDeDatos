'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

/** Estado de filtros en la URL — seccion 4.11. */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const valuesOf = useCallback(
    (fieldName: string): string[] => searchParams.getAll(fieldName),
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

  const apply = useCallback(
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

  const toggle = useCallback(
    (fieldName: string, valor: string) => {
      apply((params) => {
        const actuales = params.getAll(fieldName);
        params.delete(fieldName);
        const siguientes = actuales.includes(valor)
          ? actuales.filter((v) => v !== valor)
          : [...actuales, valor];
        for (const v of siguientes) params.append(fieldName, v);
      });
    },
    [apply],
  );

  /** Deja el campo con UN valor, o lo quita si el valor es vacio. */
  const fijar = useCallback(
    (fieldName: string, valor: string) => {
      apply((params) => {
        params.delete(fieldName);
        if (valor !== '') params.append(fieldName, valor);
      });
    },
    [apply],
  );

  const clearField = useCallback(
    (fieldName: string) => {
      apply((params) => params.delete(fieldName));
    },
    [apply],
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
      for (const [fieldName, valores] of Object.entries(filtros ?? {})) {
        for (const v of valores) params.append(fieldName, v);
      }
      const cadena = params.toString();
      // push, no replace: esto si es navegacion y debe poder deshacerse con "atras".
      router.push(cadena ? `${path}?${cadena}` : path);
    },
    [router],
  );

  return { valuesOf, toggle, fijar, clearField, limpiarTodo, navegarA, searchParams };
}
