'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

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

  const aplicar = useCallback(
    (mutar: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutar(params);
      const cadena = params.toString();
      // scroll:false evita que ajustar un filtro devuelva la pagina al principio.
      router.replace(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
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

  const limpiarCampo = useCallback(
    (campo: string) => {
      aplicar((params) => params.delete(campo));
    },
    [aplicar],
  );

  const limpiarTodo = useCallback(() => {
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

  return { valoresDe, alternar, limpiarCampo, limpiarTodo, navegarA, searchParams };
}
