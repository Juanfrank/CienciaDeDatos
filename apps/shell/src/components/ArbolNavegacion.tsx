'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavNode } from '@app/access-control';

/** Arbol de navegacion. */
export function ArbolNavegacion({ nodos, nivel = 0 }: { nodos: NavNode[]; nivel?: number }) {
  const pathname = usePathname();

  return (
    <ul className="arbol" data-nivel={nivel}>
      {nodos.map((node) =>
        node.type === 'folder' ? (
          <li key={node.id} className="arbol__carpeta">
            <span className="arbol__nombre-carpeta">{node.name}</span>
            <ArbolNavegacion nodos={node.children} nivel={nivel + 1} />
          </li>
        ) : (
          <li key={node.id}>
            <Link
              href={`/m/${node.moduleRef.slug}`}
              className={`arbol__enlace ${pathname.startsWith(`/m/${node.moduleRef.slug}`) ? 'es-activo' : ''}`}
              data-testid={`nav-${node.moduleRef.slug}`}
            >
              {node.moduleRef.name}
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
