'use client';

import { Children, createContext, useContext, useEffect, useId, useMemo, useState } from 'react';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';
import { normalizar } from './TablaBuscable';

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
  /** Todo lo que se puede escribir para dar con esta fila: nombre, URL, estado. */
  texto: string;
}

interface Plegado {
  plegadas: Set<string>;
  alternar: (id: string) => void;
  /** Si esta carpeta tiene algo dentro. Una vacia no ofrece el control: no plegaria nada. */
  tieneHijos: (id: string) => boolean;
}

const Contexto = createContext<Plegado | null>(null);

/**
 * La clave con la que cada persona guarda lo que tiene plegado, por tabla.
 *
 * Por TABLA y no una sola: la de modulos y la de carpetas dibujan arboles distintos, y con una
 * clave compartida plegar una carpeta en una la plegaba en la otra —incluso cuando alli no
 * escondia lo mismo—.
 */
const CLAVE = (tabla: string) => `admin.arbol.plegadas.${tabla}`;

export function ArbolPlegable({
  filas,
  cabecera,
  children,
  testid = 'tabla-modulos',
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
  /** Identifica la tabla: en los `data-testid` y en la clave con la que se recuerda el plegado. */
  testid?: string;
}) {
  const t = useTranslator();
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());
  const [consulta, setConsulta] = useState('');
  const idBuscador = useId();

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
      const guardado = window.localStorage.getItem(CLAVE(testid));
      if (guardado) setPlegadas(new Set(JSON.parse(guardado) as string[]));
    } catch {
      // Ventana privada, almacenamiento bloqueado o JSON corrupto: se empieza desplegado, que es
      // el estado en el que nada falta.
    }
  }, [testid]);

  const guardar = (siguiente: Set<string>) => {
    setPlegadas(siguiente);
    try {
      window.localStorage.setItem(CLAVE(testid), JSON.stringify([...siguiente]));
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

  /** Las carpetas que de hecho esconden algo. Plegar una vacia no cambia nada en pantalla. */
  const plegables = filas
    .filter((f) => f.tipo === 'carpeta' && conHijos.has(f.id))
    .map((f) => f.id);

  /*
   * Buscando, el plegado NO se aplica.
   *
   * Un resultado dentro de una carpeta plegada seria un resultado invisible, y quien busca creeria
   * que no existe. Y se ensenan tambien sus CARPETAS madre: un modulo suelto, sin la rama de la
   * que cuelga, no dice donde esta — y donde esta es lo que decide quien lo ve.
   */
  const buscado = normalizar(consulta.trim());
  const visiblesPorBusqueda = useMemo(() => {
    if (buscado === '') return null;
    const vistos = new Set<string>();
    for (const fila of filas) {
      if (!normalizar(fila.texto).includes(buscado)) continue;
      vistos.add(fila.id);
      let padre = fila.padre;
      while (padre !== null && !vistos.has(padre)) {
        vistos.add(padre);
        padre = porId.get(padre)?.padre ?? null;
      }
    }
    return vistos;
  }, [filas, buscado, porId]);

  const seVe = (fila: FilaDelArbol) =>
    visiblesPorBusqueda ? visiblesPorBusqueda.has(fila.id) : !bajoUnPlegada(fila);
  const cuantas = filas.filter(seVe).length;

  return (
    <Contexto.Provider value={valor}>
      {/*
        El buscador y los controles van EN LA MISMA LINEA.
        Eran dos bloques uno encima del otro y ocupaban dos renglones para tres controles, que en
        una pantalla que ya es una tabla larga es empujar la tabla hacia abajo por nada.
      */}
      <div className="barra-de-tabla">
        <p className="buscador">
          <label className="buscador__campo" htmlFor={`${idBuscador}-buscar`}>
            <Icon nombre="lupa" tamano={16} />
            <input
              id={`${idBuscador}-buscar`}
              type="search"
              value={consulta}
              placeholder={t('admin.search.placeholder')}
              data-testid={`buscar-${testid}`}
              onChange={(e) => setConsulta(e.target.value)}
            />
          </label>
          <span className="muted-text" role="status" data-testid={`resultados-${testid}`}>
            {t('admin.search.results', { n: cuantas, total: filas.length })}
          </span>
        </p>

        {/*
          Dos botones, no uno por nivel.
          Habia uno por cada nivel del arbol —«Plegar al nivel 1», «al 2», «al 3»— y la fila crecia
          con la organizacion: con cinco niveles son cinco botones para un gesto que casi siempre
          es «cierralo todo» o «abrelo todo». Plegar un nivel concreto se sigue pudiendo, carpeta a
          carpeta, que es cuando de verdad se quiere.

          Buscando no sirven de nada —el plegado no se aplica—, asi que se apagan en vez de
          quedarse ahi sin efecto.
        */}
        <div className="arbol-controles" role="group" aria-label={t('admin.tree.fold.controls')}>
          <button
            type="button"
            className="boton-contorno"
            disabled={plegables.length === 0 || buscado !== ''}
            data-testid="colapsar-todo"
            onClick={() => guardar(new Set(plegables))}
          >
            {t('admin.tree.fold.collapseAll')}
          </button>
          <button
            type="button"
            className="boton-contorno"
            disabled={plegadas.size === 0 || buscado !== ''}
            data-testid="desplegar-todo"
            onClick={() => guardar(new Set())}
          >
            {t('admin.tree.fold.expandAll')}
          </button>
        </div>
      </div>

      <div className="container-table">
        <table className="tabla" data-testid={testid}>
          {cabecera}
          <tbody>
            {filas.map((fila, i) => (seVe(fila) ? hijas[i] : null))}
          </tbody>
        </table>
      </div>

      {cuantas === 0 ? (
        <p className="muted-text" data-testid={`sin-resultados-${testid}`}>
          {t('admin.search.empty', { consulta: consulta.trim() })}
        </p>
      ) : null}
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
