'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavNode } from '@app/access-control';

/**
 * Arbol de navegacion.
 *
 * Dibuja lo que `buildNavigationView` devolvio, que ya esta filtrado por lo concedido al equipo.
 * Este componente no decide que es visible: si decidiera, habria dos fuentes de verdad sobre el
 * acceso y podrian divergir.
 *
 * Los enlaces son URLs por slug (4.11), no navegacion por estado: se pueden copiar, compartir y
 * abrir en una pestaña nueva.
 */
export function ArbolNavegacion({ nodos, nivel = 0 }: { nodos: NavNode[]; nivel?: number }) {
  const pathname = usePathname();

  return (
    <ul className="arbol" data-nivel={nivel}>
      {nodos.map((nodo) =>
        nodo.type === 'folder' ? (
          <li key={nodo.id} className="arbol__carpeta">
            <span className="arbol__nombre-carpeta">{nodo.name}</span>
            <ArbolNavegacion nodos={nodo.children} nivel={nivel + 1} />
          </li>
        ) : (
          <li key={nodo.id}>
            <Link
              href={`/m/${nodo.moduleRef.slug}`}
              className={`arbol__enlace ${pathname.startsWith(`/m/${nodo.moduleRef.slug}`) ? 'es-activo' : ''}`}
              data-testid={`nav-${nodo.moduleRef.slug}`}
            >
              {nodo.moduleRef.name}
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
