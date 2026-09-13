'use client';

import { useRef } from 'react';
import { GRID_COLUMNS, type GridItem, type GridPosition } from '@app/module-model';
import { ObjetoDeModulo } from '../ObjetoDeModulo';
import type { ObjetoSerializado } from '../../server/serializar';
import { Icono } from '../iconos/Icono';
import { useArrastre } from './useArrastre';

/** El lienzo del editor: el modulo DE VERDAD, con su rejilla a la vista. */
export function Lienzo({
  items,
  objetos,
  seleccion,
  editable,
  onSeleccionar,
  onColocar,
}: {
  items: GridItem[];
  objetos: ObjetoSerializado[];
  seleccion: string | null;
  /** Sin permiso de edicion no hay asas: el lienzo se mira, no se reordena. */
  editable: boolean;
  onSeleccionar: (itemId: string | null) => void;
  onColocar: (itemId: string, position: GridPosition) => void;
}) {
  const id = new Map(objetos.map((o) => [o.itemId, o]));

  /*
   * Dos filas de mas, siempre.
   */
  const filasUsadas = items.reduce((m, i) => Math.max(m, i.position.y + i.position.h), 0);
  const dataRows = filasUsadas + 2;

  const rejilla = useRef<HTMLDivElement>(null);
  const { enCurso, alEmpezar, alMover, alSoltar, alCancelar } = useArrastre({
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
    >
      <div
        ref={rejilla}
        className="lienzo__rejilla"
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
        <div className="lienzo__guias" aria-hidden="true">
          {Array.from({ length: GRID_COLUMNS * dataRows }, (_, i) => (
            <span key={i} className="lienzo__guia" />
          ))}
        </div>

        {/*
          La sombra del destino, mientras se arrastra.
          Se dibuja como una celda mas de la rejilla, no como un rectangulo flotante: asi ocupa
          exactamente lo que ocupara el bloque al soltarlo, con el mismo hueco y las mismas lineas.
        */}
        {enCurso ? (
          <div
            className="lienzo__sombra"
            data-valido={enCurso.valido ? 'si' : 'no'}
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
              {enCurso.valido ? '' : ' · ocupado'}
            </span>
          </div>
        ) : null}

        {items.map((item) => {
          const objeto = id.get(item.id);
          const chosen = seleccion === item.id;
          const arrastrando = enCurso?.itemId === item.id;
          return (
            <div
              key={item.id}
              className="lienzo__bloque"
              data-testid={`bloque-${item.id}`}
              data-chosen={chosen ? 'si' : 'no'}
              data-arrastrando={arrastrando ? 'si' : 'no'}
              style={
                {
                  gridColumn: `${item.position.x + 1} / span ${item.position.w}`,
                  gridRow: `${item.position.y + 1} / span ${item.position.h}`,
                } as React.CSSProperties
              }
            >
              <span className="lienzo__medida" aria-hidden="true">
                {item.position.w}×{item.position.h}
              </span>
              <div className="lienzo__contenido" {...({ inert: '' } as Record<string, string>)}>
                {objeto ? (
                  <ObjetoDeModulo objeto={objeto} />
                ) : (
                  <p className="texto-atenuado">Sin datos todavia.</p>
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
                    className="lienzo__asa lienzo__asa--mover"
                    // `tabIndex={-1}` y `aria-hidden`: el camino accesible para mover son los
                    // botones del panel, que hacen exactamente lo mismo. Un asa en el orden de
                    // tabulacion seria una parada que no lleva a ninguna parte con el teclado.
                    tabIndex={-1}
                    aria-hidden="true"
                    data-testid={`asa-mover-${item.id}`}
                    // Un asa es un boton, asi que al soltar dispara un `click` que sube hasta el
                    // lienzo — y el lienzo deselecciona al pulsar el fondo. Sin cortarlo, terminar
                    // de arrastrar deseleccionaba el bloque que se acababa de mover.
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => alEmpezar(e, item, 'mover')}
                    onPointerMove={alMover}
                    onPointerUp={alSoltar}
                    onPointerCancel={alCancelar}
                  >
                    <Icono nombre="sandwich" tamano={14} />
                  </button>
                  <button
                    type="button"
                    className="lienzo__asa lienzo__asa--medir"
                    tabIndex={-1}
                    aria-hidden="true"
                    data-testid={`asa-medir-${item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => alEmpezar(e, item, 'redimensionar')}
                    onPointerMove={alMover}
                    onPointerUp={alSoltar}
                    onPointerCancel={alCancelar}
                  />
                </>
              ) : null}

              <button
                type="button"
                className="lienzo__seleccionar"
                data-testid={`elegir-${item.id}`}
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
        <p className="lienzo__vacio" data-testid="lienzo-vacio">
          Este modulo esta empty. Elija una visualizacion en el panel de la derecha.
        </p>
      ) : null}
    </div>
  );
}
