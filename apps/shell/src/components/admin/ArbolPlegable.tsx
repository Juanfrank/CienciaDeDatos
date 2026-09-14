'use client';

import { Children, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';

/**
 * Plegar y desplegar la tabla del arbol, por nivel — secciones 4.1 y 4.10.8.
 *
 * El problema que resuelve no es de adorno: la organizacion general tiene tres niveles y crece,
 * y una tabla que los enseña todos siempre obliga a recorrer treinta filas para llegar a la
 * carpeta que interesa. Plegando, el arbol se lee como un arbol.
 *
 * El montaje tiene una vuelta de tuerca. Las filas se dibujan en el SERVIDOR —llevan traductor,
 * datos del almacen y componentes de servidor dentro—, pero el boton que pliega y el estado que
 * decide que se ve son de cliente. No se pueden pasar funciones de un servidor a un cliente (eso
 * ya costo un fallo entero en `BumpModule`), asi que el estado viaja por CONTEXTO: este
 * componente lo provee, las filas del servidor pasan por el como `children` sin enterarse, y
 * dentro de cada fila de carpeta hay un `BotonPlegar` —de cliente— que lo consume.
 *
 * El filtrado se hace por indice contra `filas`, que viene en paralelo a los `children`. Es un
 * contrato entre dos listas, con lo que eso tiene: si divergen, se pliega la fila equivocada. Por
 * eso hay una comprobacion en desarrollo y una prueba de navegador que cuenta filas.
 */
export interface FilaDelArbol {
  id: string;
  tipo: 'carpeta' | 'modulo';
  profundidad: number;
  padre: string | null;
}

interface Plegado {
  plegadas: Set<string>;
  alternar: (id: string) => void;
  /** Si esta carpeta tiene algo dentro. Una vacia no ofrece el control: no plegaria nada. */
  tieneHijos: (id: string) => boolean;
}

const Contexto = createContext<Plegado | null>(null);

/** La clave con la que cada persona guarda lo que tiene plegado. */
const CLAVE = 'admin.arbol.plegadas';

export function ArbolPlegable({
  filas,
  cabecera,
  children,
}: {
  filas: FilaDelArbol[];
  /*
   * La cabecera va por su propia prop y no como primer `children`.
   *
   * Con las dos cosas mezcladas, el filtrado seria `hijas[i + 1]` y ese `+ 1` es un contrato
   * tacito entre dos listas: el dia que alguien anada un `<caption>` delante, se pliega la fila
   * equivocada y no lo dice nadie.
   */
  cabecera: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslator();
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());

  /*
   * Lo plegado es de quien mira, no del modulo.
   *
   * Vive en su navegador y no en el almacen: no es una decision sobre la organizacion —eso son
   * mover, ocultar y los permisos—, es como prefiere leer la pantalla esta persona. Guardarlo en
   * el servidor lo compartiria con todo el mundo, que no es lo que nadie espera de un triangulo.
   *
   * Se lee DESPUES de montar, no durante el primer dibujo: leer `localStorage` en el render
   * dejaria lo que pinta el servidor distinto de lo que pinta el cliente.
   */
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      if (guardado) setPlegadas(new Set(JSON.parse(guardado) as string[]));
    } catch {
      // Ventana privada, almacenamiento bloqueado o JSON corrupto: se empieza desplegado, que es
      // el estado en el que nada falta.
    }
  }, []);

  const guardar = (siguiente: Set<string>) => {
    setPlegadas(siguiente);
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify([...siguiente]));
    } catch {
      // Que no se pueda recordar no puede impedir plegar.
    }
  };

  const conHijos = useMemo(
    () => new Set(filas.map((f) => f.padre).filter((p): p is string => p !== null)),
    [filas],
  );

  const valor: Plegado = {
    plegadas,
    tieneHijos: (id) => conHijos.has(id),
    alternar: (id) => {
      const siguiente = new Set(plegadas);
      if (!siguiente.delete(id)) siguiente.add(id);
      guardar(siguiente);
    },
  };

  const porId = useMemo(() => new Map(filas.map((f) => [f.id, f])), [filas]);

  /** Si alguno de sus ancestros esta plegado. Uno basta: lo de dentro no se ve igualmente. */
  const bajoUnPlegada = (fila: FilaDelArbol): boolean => {
    let actual = fila.padre;
    while (actual !== null) {
      if (plegadas.has(actual)) return true;
      actual = porId.get(actual)?.padre ?? null;
    }
    return false;
  };

  const hijas = Children.toArray(children);
  const profundidadMaxima = filas.reduce((n, f) => Math.max(n, f.profundidad), 0);

  return (
    <Contexto.Provider value={valor}>
      {/*
        Plegar por NIVEL, no solo carpeta a carpeta.
        Con tres niveles y veinte carpetas, ir una por una es el mismo trabajo que leerlas todas.
      */}
      <div className="arbol-controles" role="group" aria-label={t('admin.tree.fold.controls')}>
        <button
          type="button"
          className="boton-contorno"
          disabled={plegadas.size === 0}
          data-testid="desplegar-todo"
          onClick={() => guardar(new Set())}
        >
          {t('admin.tree.fold.expandAll')}
        </button>
        {Array.from({ length: profundidadMaxima }, (_, i) => i).map((nivel) => (
          <button
            key={nivel}
            type="button"
            className="boton-contorno"
            data-testid={`plegar-nivel-${nivel}`}
            onClick={() =>
              guardar(
                new Set(
                  filas
                    .filter((f) => f.tipo === 'carpeta' && f.profundidad >= nivel && conHijos.has(f.id))
                    .map((f) => f.id),
                ),
              )
            }
          >
            {t('admin.tree.fold.toLevel', { n: nivel + 1 })}
          </button>
        ))}
      </div>

      <div className="container-table">
        <table className="tabla" data-testid="tabla-modulos">
          {cabecera}
          <tbody>
            {filas.map((fila, i) => (bajoUnPlegada(fila) ? null : hijas[i]))}
          </tbody>
        </table>
      </div>
    </Contexto.Provider>
  );
}

/**
 * El triangulo que pliega una carpeta.
 *
 * Vive DENTRO de una fila dibujada en el servidor y aun asi es de cliente: lo unico que cruza esa
 * frontera es el `nodeId`, que es un dato. El estado lo saca del contexto.
 */
export function BotonPlegar({ nodeId, nombre }: { nodeId: string; nombre: string }) {
  const t = useTranslator();
  const plegado = useContext(Contexto);

  // Una carpeta vacia no ofrece el control: pulsarlo no plegaria nada, y un boton que no hace
  // nada es peor que la ausencia del boton.
  if (!plegado || !plegado.tieneHijos(nodeId)) {
    return <span className="arbol-hueco" aria-hidden="true" />;
  }

  const abierta = !plegado.plegadas.has(nodeId);
  const rotulo = abierta ? t('admin.tree.fold.collapse') : t('admin.tree.fold.expand');

  return (
    <button
      type="button"
      className="arbol-plegar"
      aria-expanded={abierta}
      title={rotulo}
      aria-label={`${rotulo}: ${nombre}`}
      data-testid={`plegar-${nodeId}`}
      onClick={() => plegado.alternar(nodeId)}
    >
      <Icon nombre="chevron-abajo" tamano={16} />
    </button>
  );
}
