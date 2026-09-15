'use client';

import { useRef } from 'react';
import { GRID_COLUMNS, overlapItself, type GridPosition } from '@app/module-model';
import { useDrag } from './editor/useDrag';
import { useTranslator } from './Locale';
import { Icon } from './icons/Icon';
import { ModuleObject } from './ModuleObject';
import type { SerializedObject } from '../server/serialize';

/**
 * Colocar los objetos en MI vista — seccion 4.6, apartado 2.2 de la hoja de ruta.
 *
 * `UserPersonalization` admitia `positionOverrides` y `applyPersonalization` los aplicaba desde el
 * principio; lo que faltaba era el gesto. Estaba escrito en el editor, asi que esto lo PORTA —el
 * mismo `useDrag`, las mismas clases— en vez de escribir un segundo arrastre que se comportara
 * parecido. Dos arrastres distintos acaban divergiendo, y el que se usa menos es el que se rompe.
 *
 * Mientras se coloca, la rejilla se dibuja con filas de alto fijo y colocacion absoluta, que es la
 * del editor y no la del visor. No es un capricho: la rejilla del visor coloca por flujo y el
 * arrastre necesita saber a que fila corresponde cada pixel. Al guardar se vuelve a la de siempre.
 *
 * El teclado hace lo MISMO, no algo parecido: las flechas mueven y con Mayus redimensionan, sobre
 * la misma comprobacion de solapamiento. 4.9 dice que la accesibilidad no se pospone, y un gesto
 * que solo existe con raton es un gesto que la mitad de la institucion no tiene.
 */

const acotar = (valor: number, minimo: number, maximo: number) =>
  Math.min(maximo, Math.max(minimo, valor));

export function Reorganizar({
  objetos,
  posiciones,
  onColocar,
}: {
  objetos: SerializedObject[];
  /** Donde esta cada objeto AHORA, incluida la colocacion a medio hacer. */
  posiciones: Record<string, GridPosition>;
  onColocar: (itemId: string, position: GridPosition) => void;
}) {
  const items = objetos.map((o) => ({
    id: o.itemId,
    position: posiciones[o.itemId] ?? o.position,
  }));

  const filasUsadas = items.reduce((m, i) => Math.max(m, i.position.y + i.position.h), 0);
  const filas = filasUsadas + 2;

  const t = useTranslator();
  const rejilla = useRef<HTMLDivElement>(null);
  const { enCurso, alEmpezar, moveTo, alSoltar, alCancelar } = useDrag({
    items,
    rejilla,
    onSoltar: onColocar,
  });

  /** Mueve o redimensiona con el teclado, si el destino cabe y no pisa a nadie. */
  const conElTeclado = (e: React.KeyboardEvent, itemId: string, actual: GridPosition) => {
    const paso: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = paso[e.key];
    if (!delta) return;
    e.preventDefault();

    const [dx, dy] = delta;
    const destino: GridPosition = e.shiftKey
      ? {
          ...actual,
          w: acotar(actual.w + dx, 1, GRID_COLUMNS - actual.x),
          h: Math.max(1, actual.h + dy),
        }
      : {
          ...actual,
          x: acotar(actual.x + dx, 0, GRID_COLUMNS - actual.w),
          y: Math.max(0, actual.y + dy),
        };

    const libre = !items.some((i) => i.id !== itemId && overlapItself(i.position, destino));
    if (libre) onColocar(itemId, destino);
  };

  const byId = new Map(objetos.map((o) => [o.itemId, o]));

  return (
    <div
      ref={rejilla}
      className="canvas__grid"
      data-testid="reorganizar"
      data-arrastrando={enCurso ? 'si' : 'no'}
      style={
        {
          '--rejilla-columnas': GRID_COLUMNS,
          '--rejilla-filas': filas,
          gridTemplateRows: `repeat(${filas}, var(--alto-de-fila))`,
        } as React.CSSProperties
      }
    >
      {/* Decorativas: anunciar doce celdas vacias antes de cada objeto seria ruido. */}
      <div className="canvas__guias" aria-hidden="true">
        {Array.from({ length: GRID_COLUMNS * filas }, (_, i) => (
          <span key={i} className="canvas__guia" />
        ))}
      </div>

      {enCurso ? (
        <div
          className="canvas__sombra"
          data-valid={enCurso.valid ? 'si' : 'no'}
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
        const objeto = byId.get(item.id);
        const titulo = objeto?.titulo ?? item.id;
        return (
          <div
            key={item.id}
            className="canvas__block"
            data-testid={`reorganizar-${item.id}`}
            data-arrastrando={enCurso?.itemId === item.id ? 'si' : 'no'}
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

            {/*
              El objeto de verdad, no un rectangulo con su nombre: colocar a ciegas y descubrir al
              guardar que el grafico no cabe es volver a empezar. `inert` para que nada de dentro
              reciba el foco ni responda a los clics mientras se coloca.
            */}
            <div className="canvas__contenido" {...({ inert: '' } as Record<string, string>)}>
              {objeto ? <ModuleObject objeto={objeto} /> : null}
            </div>

            <button
              type="button"
              className="canvas__handle canvas__move-handle"
              tabIndex={-1}
              aria-hidden="true"
              data-testid={`reorganizar-asa-${item.id}`}
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
              data-testid={`reorganizar-tamano-${item.id}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => alEmpezar(e, item, 'redimensionar')}
              onPointerMove={moveTo}
              onPointerUp={alSoltar}
              onPointerCancel={alCancelar}
            />

            {/*
              El camino del teclado, que es el que las asas no dan: son `aria-hidden` porque un asa
              en el orden de tabulacion es una parada que no lleva a ninguna parte sin puntero.

              El nombre dice QUE es y DONDE esta. La rejilla se ve con los ojos; quien no la ve
              necesita esa misma informacion dicha con palabras, y la necesita DESPUES de cada
              movimiento, por eso va en la etiqueta y no en un texto de ayuda aparte.
            */}
            <button
              type="button"
              className="canvas__select"
              data-testid={`reorganizar-foco-${item.id}`}
              aria-label={t('module.place.at', {
                titulo,
                desde: item.position.x + 1,
                hasta: item.position.x + item.position.w,
                columnas: GRID_COLUMNS,
                fila: item.position.y + 1,
              })}
              onKeyDown={(e) => conElTeclado(e, item.id, item.position)}
            />
          </div>
        );
      })}
    </div>
  );
}
