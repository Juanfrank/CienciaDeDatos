'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavNode } from '@app/access-control';

/** Arbol de navegacion. */
export function NavigationTree({ nodos, nivel = 0 }: { nodos: NavNode[]; nivel?: number }) {
  const pathname = usePathname();

  return (
    <ul className="arbol" data-level={nivel}>
      {nodos.map((node) =>
        node.type === 'folder' ? (
          <li key={node.id} className="tree__folder">
            <span className="tree__folder-name">{node.name}</span>
            <NavigationTree nodos={node.children} nivel={nivel + 1} />
          </li>
        ) : (
          <li key={node.id}>
            <Link
              href={`/m/${node.moduleRef.slug}`}
              className={`tree__enlace ${pathname.startsWith(`/m/${node.moduleRef.slug}`) ? 'is-active' : ''}`}
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
