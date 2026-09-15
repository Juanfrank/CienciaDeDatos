'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { NavNode } from '@app/access-control';
import { iconNameIs } from '@app/ui-components';
import { Icon, type IconName } from './icons/Icon';

/**
 * Arbol de navegacion de modulos.
 *
 * Dos cosas que antes no hacia y que un arbol tiene que hacer:
 *
 * 1. **Las carpetas se pliegan.** Un equipo con seis carpetas de cuatro modulos cada una son
 *    treinta lineas en un carril de 280 px: hay que desplazarse para ver si existe lo que uno
 *    busca. Plegar lo que no interesa ahora es la unica forma de que el arbol quepa.
 * 2. **Cada cosa lleva su icono.** Una carpeta y un modulo se leian igual —texto suelto, uno
 *    sangrado— y la sangria sola no distingue una carpeta vacia de un modulo. El icono dice
 *    QUE es antes de leer el nombre.
 */

/** El icono de un modulo que no declara ninguno. Un grafico de barras: lo que un modulo ensena. */
export const ICONO_DE_MODULO: IconName = 'barras';

/** El de una carpeta. No se configura: una carpeta es una carpeta. */
const ICONO_DE_CARPETA: IconName = 'carpeta';

const CLAVE = 'navegacion:carpetas-plegadas';

/** El icono declarado, si el catalogo lo reconoce; si no, el de por defecto. */
const iconoDe = (declarado: string | undefined, porDefecto: IconName): IconName =>
  declarado !== undefined && iconNameIs(declarado) ? declarado : porDefecto;

export function NavigationTree({ nodos }: { nodos: NavNode[] }) {
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());

  /*
   * Lo plegado es de quien mira, y vive en su navegador.
   *
   * No es una decision sobre la organizacion —eso son mover, ocultar y los permisos—, es como
   * prefiere leer el carril esta persona. Se lee DESPUES de montar: leerlo durante el render
   * dejaria lo que pinta el servidor distinto de lo que pinta el cliente.
   */
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      if (guardado) setPlegadas(new Set(JSON.parse(guardado) as string[]));
    } catch {
      // Ventana privada, almacenamiento bloqueado o JSON corrupto: se empieza desplegado, que es
      // el estado en el que no falta nada.
    }
  }, []);

  const alternar = (id: string) => {
    const siguiente = new Set(plegadas);
    if (!siguiente.delete(id)) siguiente.add(id);
    setPlegadas(siguiente);
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify([...siguiente]));
    } catch {
      // Que no se pueda recordar no puede impedir plegar.
    }
  };

  return <Rama nodos={nodos} nivel={0} plegadas={plegadas} alternar={alternar} />;
}

function Rama({
  nodos,
  nivel,
  plegadas,
  alternar,
}: {
  nodos: NavNode[];
  nivel: number;
  plegadas: Set<string>;
  alternar: (id: string) => void;
}) {
  const pathname = usePathname();

  return (
    <ul className="arbol" data-level={nivel}>
      {nodos.map((node) => {
        const esCarpeta = node.type === 'folder';
        return esCarpeta ? (
          <li key={node.id} className="tree__folder">
            {/*
              El boton ENVUELVE el nombre de la carpeta, no va al lado.

              Al lado, el area pulsable es un triangulo de dieciseis pixeles y el nombre —que es lo
              que la mano va a buscar— no hace nada. Envolviendolo, toda la linea pliega, que es lo
              que hace cualquier arbol.
            */}
            <button
              type="button"
              className="tree__folder-name"
              aria-expanded={!plegadas.has(node.id)}
              data-testid={`nav-carpeta-${node.id}`}
              onClick={() => alternar(node.id)}
            >
              {/* Decorativo: al lado esta el nombre y el estado lo dice `aria-expanded`. */}
              <Icon nombre={iconoDe(node.icon, ICONO_DE_CARPETA)} tamano={16} />
              <span className="tree__nombre">{node.name}</span>
              <Icon nombre="chevron-abajo" tamano={16} />
            </button>

            {plegadas.has(node.id) ? null : (
              <Rama
                nodos={node.children}
                nivel={nivel + 1}
                plegadas={plegadas}
                alternar={alternar}
              />
            )}
          </li>
        ) : (
          <li key={node.id}>
            <Link
              href={`/m/${node.moduleRef.slug}`}
              className={`tree__link ${pathname.startsWith(`/m/${node.moduleRef.slug}`) ? 'is-active' : ''}`}
              data-testid={`nav-${node.moduleRef.slug}`}
            >
              <Icon nombre={iconoDe(node.moduleRef.icon, ICONO_DE_MODULO)} tamano={16} />
              <span className="tree__nombre">{node.moduleRef.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
