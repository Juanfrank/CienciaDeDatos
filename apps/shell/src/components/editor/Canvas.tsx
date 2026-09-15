'use client';

import { useCallback, useRef, useState } from 'react';
import { GRID_COLUMNS, type GridItem, type GridPosition } from '@app/module-model';
import { ModuleObject } from '../ModuleObject';
import type { SerializedObject } from '../../server/serialize';
import { Icon } from '../icons/Icon';
import { useDrag } from './useDrag';
import { useTranslator } from '../Locale';
import {
  ObjectMenu,
  useContextMenu,
  useContextMenuOn,
  useMenuKey,
  type AccionDeObjeto,
} from '../ObjectMenu';

/** El lienzo del editor: el modulo DE VERDAD, con su rejilla a la vista. */
export function Canvas({
  items,
  objetos,
  selection,
  editable,
  onSeleccionar,
  onColocar,
  onDuplicar,
  onQuitar,
}: {
  items: GridItem[];
  objetos: SerializedObject[];
  selection: string | null;
  /** Sin permiso de edicion no hay asas: el lienzo se mira, no se reordena. */
  editable: boolean;
  onSeleccionar: (itemId: string | null) => void;
  onColocar: (itemId: string, position: GridPosition) => void;
  /** Las dos del menu contextual. Las decide el editor; el lienzo solo las ofrece. */
  onDuplicar?: (itemId: string) => void;
  onQuitar?: (itemId: string) => void;
}) {
  const id = new Map(objetos.map((o) => [o.itemId, o]));

  /*
   * El menu contextual del bloque.
   *
   * Uno para el lienzo entero y no uno por bloque: solo puede haber un menu abierto a la vez, y
   * con uno por bloque habria que apagarlos todos al abrir cualquiera — el estado seria el mismo
   * repetido n veces, que es como se acaba con dos menus abiertos.
   */
  const t = useTranslator();
  const lienzo = useRef<HTMLDivElement>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const { punto, abrir, abrirEnElFoco, cerrar } = useContextMenu();
  useMenuKey(lienzo, abrirEnElFoco);
  /*
   * El boton derecho se captura en el LIENZO y se averigua sobre que bloque cayo.
   *
   * Por captura y no por burbujeo: el contenido de cada bloque lleva un objeto de verdad, con su
   * grafico, y el lienzo de ECharts atiende el evento sin dejarlo subir — justo encima del dato, que
   * es donde cualquiera pulsa, no pasaria nada.
   */
  const abrirSobreElBloque = useCallback(
    (e: { clientX: number; clientY: number; preventDefault: () => void }) => {
      const destino = (e as unknown as MouseEvent).target;
      const bloque =
        destino instanceof Element ? destino.closest<HTMLElement>('[data-testid^="block-"]') : null;
      const id = bloque?.dataset['testid']?.replace('block-', '') ?? null;
      if (!id) return;
      setSobre(id);
      abrir(e);
    },
    [abrir],
  );
  useContextMenuOn(lienzo, abrirSobreElBloque, editable);

  const accionesDe = (itemId: string): AccionDeObjeto[] => [
    { id: 'configurar', etiqueta: t('menu.object.configure'), onElegir: () => onSeleccionar(itemId) },
    ...(onDuplicar
      ? [{ id: 'duplicar', etiqueta: t('menu.object.duplicate'), onElegir: () => onDuplicar(itemId) }]
      : []),
    ...(onQuitar
      ? [
          {
            id: 'quitar',
            etiqueta: t('menu.object.remove'),
            peligrosa: true,
            onElegir: () => onQuitar(itemId),
          },
        ]
      : []),
  ];

  /*
   * Dos filas de mas, siempre.
   */
  const usedRows = items.reduce((m, i) => Math.max(m, i.position.y + i.position.h), 0);
  const dataRows = usedRows + 2;

  const rejilla = useRef<HTMLDivElement>(null);
  const { enCurso, alEmpezar, moveTo, alSoltar, alCancelar } = useDrag({
    items,
    rejilla,
    onSoltar: onColocar,
  });

  return (
    <div
      className="lienzo"
      data-testid="lienzo"
      // Pulsar el fondo deselecciona, como en cualquier editor de bloques. Es un div y no un
      // boton a proposito: no es una accion que haga falta alcanzar con el tabulador —Escape ya
      // deselecciona— y envolver el lienzo entero en un boton anidaria botones dentro de botones.
      onClick={() => onSeleccionar(null)}
      ref={lienzo}
    >
      <div
        ref={rejilla}
        className="canvas__grid"
        data-arrastrando={enCurso ? 'si' : 'no'}
        style={
          {
            '--rejilla-columnas': GRID_COLUMNS,
            '--rejilla-filas': dataRows,
            /*
             * Filas de alto FIJO, las mismas que el modulo publicado.
             */
            gridTemplateRows: `repeat(${dataRows}, var(--alto-de-fila))`,
          } as React.CSSProperties
        }
      >
        {/*
          Las guias de la rejilla: una celda por cruce de columna y fila. Decorativas: `aria-hidden`, porque para quien no ve la pantalla la
          rejilla no aporta nada y anunciar doce celdas vacias antes de cada objeto seria ruido.
          La posicion de cada bloque se dice con palabras en el panel.
        */}
        <div className="canvas__guias" aria-hidden="true">
          {Array.from({ length: GRID_COLUMNS * dataRows }, (_, i) => (
            <span key={i} className="canvas__guia" />
          ))}
        </div>

        {/*
          La sombra del destino, mientras se arrastra.
          Se dibuja como una celda mas de la rejilla, no como un rectangulo flotante: asi ocupa
          exactamente lo que ocupara el bloque al soltarlo, con el mismo hueco y las mismas lineas.
        */}
        {enCurso ? (
          <div
            className="canvas__sombra"
            data-valid={enCurso.valid ? 'si' : 'no'}
            data-testid="sombra-de-arrastre"
            aria-hidden="true"
            style={
              {
                gridColumn: `${enCurso.destino.x + 1} / span ${enCurso.destino.w}`,
                gridRow: `${enCurso.destino.y + 1} / span ${enCurso.destino.h}`,
              } as React.CSSProperties
            }
          >
            <span>
              {enCurso.destino.w}×{enCurso.destino.h}
              {enCurso.valid ? '' : ' · ocupado'}
            </span>
          </div>
        ) : null}

        {items.map((item) => {
          const objeto = id.get(item.id);
          const chosen = selection === item.id;
          const arrastrando = enCurso?.itemId === item.id;
          return (
            <div
              key={item.id}
              className="canvas__block"
              data-testid={`block-${item.id}`}
              data-chosen={chosen ? 'si' : 'no'}
              data-arrastrando={arrastrando ? 'si' : 'no'}
              style={
                {
                  gridColumn: `${item.position.x + 1} / span ${item.position.w}`,
                  gridRow: `${item.position.y + 1} / span ${item.position.h}`,
                } as React.CSSProperties
              }
            >
              <span className="canvas__measure" aria-hidden="true">
                {item.position.w}×{item.position.h}
              </span>
              <div className="canvas__contenido" {...({ inert: '' } as Record<string, string>)}>
                {objeto ? (
                  <ModuleObject objeto={objeto} />
                ) : (
                  <p className="muted-text">Sin datos todavia.</p>
                )}
              </div>
              {editable ? (
                <>
                  {/*
                    Dos asas, y las dos por encima del boton de seleccion: arrastrar el bloque
                    entero seria comodo y haria imposible seleccionar sin mover, porque cualquier
                    clic con un pixel de desplazamiento pasaria a ser un arrastre.
                  */}
                  <button
                    type="button"
                    className="canvas__handle canvas__move-handle"
                    // `tabIndex={-1}` y `aria-hidden`: el camino accesible para mover son los
                    // botones del panel, que hacen exactamente lo mismo. Un asa en el orden de
                    // tabulacion seria una parada que no lleva a ninguna parte con el teclado.
                    tabIndex={-1}
                    aria-hidden="true"
                    data-testid={`move-handle-${item.id}`}
                    // Un asa es un boton, asi que al soltar dispara un `click` que sube hasta el
                    // lienzo — y el lienzo deselecciona al pulsar el fondo. Sin cortarlo, terminar
                    // de arrastrar deseleccionaba el bloque que se acababa de mover.
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => alEmpezar(e, item, 'mover')}
                    onPointerMove={moveTo}
                    onPointerUp={alSoltar}
                    onPointerCancel={alCancelar}
                  >
                    <Icon nombre="sandwich" tamano={14} />
                  </button>
                  <button
                    type="button"
                    className="canvas__handle canvas__resize-handle"
                    tabIndex={-1}
                    aria-hidden="true"
                    data-testid={`resize-handle-${item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => alEmpezar(e, item, 'redimensionar')}
                    onPointerMove={moveTo}
                    onPointerUp={alSoltar}
                    onPointerCancel={alCancelar}
                  />
                </>
              ) : null}

              <button
                type="button"
                className="canvas__select"
                data-testid={`select-${item.id}`}
                aria-pressed={chosen}
                // El nombre dice QUE es y DONDE esta: la rejilla se ve con los ojos, y quien no la
                // ve necesita esa misma informacion dicha con palabras.
                aria-label={`${item.instance.title ?? item.instance.objectId}, columna ${
                  item.position.x + 1
                } a ${item.position.x + item.position.w} de ${GRID_COLUMNS}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeleccionar(item.id);
                }}
              />
            </div>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="canvas__empty" data-testid="empty-canvas">
          Este modulo esta vacio. Elija una visualizacion en el panel de la derecha.
        </p>
      ) : null}

      {/*
        UN menu para el lienzo, con las acciones del bloque sobre el que se abrio.
        Abierto con el teclado no hay bloque bajo el puntero: se toma el elegido, que es lo que el
        foco esta recorriendo.
      */}
      <ObjectMenu
        punto={punto}
        acciones={accionesDe(sobre ?? selection ?? '')}
        titulo={items.find((i) => i.id === (sobre ?? selection))?.instance.title ?? 'Objeto'}
        onCerrar={cerrar}
      />
    </div>
  );
}
