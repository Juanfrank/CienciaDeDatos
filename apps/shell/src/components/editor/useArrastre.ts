'use client';

import { GRID_COLUMNS, seSolapan, type GridItem, type GridPosition } from '@app/module-model';
import { useCallback, useRef, useState } from 'react';

/**
 * Arrastrar para mover y para redimensionar, sobre la rejilla del editor.
 *
 * Tres decisiones que conviene tener escritas:
 *
 * 1. **Va sobre las MISMAS operaciones que los botones.** El arrastre calcula una `GridPosition` y
 *    la entrega; quien la recibe es el mismo `onCambiar` que usan «Mas ancho» y «Mover a la
 *    derecha». No hay un segundo camino que pueda divergir del primero, que era la condicion con
 *    la que se aplazo esto.
 *
 * 2. **El teclado no pierde nada.** Los botones siguen ahi y hacen lo mismo. 4.9 no admite que una
 *    funcion exista solo para quien usa raton, y un lienzo que solo se ordena arrastrando ordena
 *    solo para parte de la gente.
 *
 * 3. **Un destino ocupado se RECHAZA, no se resuelve solo.** Empujar los objetos de alrededor es
 *    lo que hacen otros editores y es donde se pierde el control: se mueve uno y se descolocan
 *    tres. Aqui la vista previa se marca invalida y al soltar no pasa nada.
 *
 * Se usan eventos de PUNTERO, no de raton: el mismo codigo vale para dedo y para lapiz, y
 * `setPointerCapture` mantiene el arrastre aunque el cursor salga del bloque, que es lo que pasa
 * en cuanto se mueve deprisa.
 */

export type ModoDeArrastre = 'mover' | 'redimensionar';

export interface ArrastreEnCurso {
  itemId: string;
  modo: ModoDeArrastre;
  /** Donde caeria si se soltara ahora. */
  destino: GridPosition;
  valido: boolean;
}

interface Origen {
  itemId: string;
  modo: ModoDeArrastre;
  inicial: GridPosition;
  /** Coordenadas del puntero al empezar, para medir el desplazamiento. */
  x: number;
  y: number;
  /** Tamano de una celda, medido del propio lienzo. */
  anchoDeCelda: number;
  altoDeCelda: number;
}

const acotar = (valor: number, minimo: number, maximo: number) =>
  Math.min(maximo, Math.max(minimo, valor));

/**
 * El tamano de una celda, medido de la rejilla real.
 *
 * No se calcula de una constante: la rejilla es fluida y su ancho depende del panel, del lateral y
 * de la ventana. Medirla es lo unico que hace que el bloque siga al cursor en vez de ir por
 * delante o por detras.
 */
function medirCelda(rejilla: HTMLElement, filas: number): { ancho: number; alto: number } {
  const caja = rejilla.getBoundingClientRect();
  const hueco = parseFloat(getComputedStyle(rejilla).gap || '0') || 0;
  return {
    ancho: (caja.width - hueco * (GRID_COLUMNS - 1)) / GRID_COLUMNS,
    alto: filas > 0 ? (caja.height - hueco * (filas - 1)) / filas : caja.height,
  };
}

export function useArrastre({
  items,
  filas,
  rejilla,
  onSoltar,
}: {
  items: GridItem[];
  filas: number;
  rejilla: React.RefObject<HTMLDivElement | null>;
  onSoltar: (itemId: string, position: GridPosition) => void;
}) {
  const [enCurso, setEnCurso] = useState<ArrastreEnCurso | null>(null);
  const origen = useRef<Origen | null>(null);

  const calcular = useCallback(
    (o: Origen, clienteX: number, clienteY: number): ArrastreEnCurso => {
      const dx = Math.round((clienteX - o.x) / (o.anchoDeCelda + 16));
      const dy = Math.round((clienteY - o.y) / (o.altoDeCelda + 16));

      let destino: GridPosition;
      if (o.modo === 'mover') {
        destino = {
          ...o.inicial,
          x: acotar(o.inicial.x + dx, 0, GRID_COLUMNS - o.inicial.w),
          // Sin tope por abajo: la rejilla crece, y el editor anade filas libres al final.
          y: Math.max(0, o.inicial.y + dy),
        };
      } else {
        destino = {
          ...o.inicial,
          w: acotar(o.inicial.w + dx, 1, GRID_COLUMNS - o.inicial.x),
          h: Math.max(1, o.inicial.h + dy),
        };
      }

      const valido = !items.some(
        (i) => i.id !== o.itemId && seSolapan(i.position, destino),
      );
      return { itemId: o.itemId, modo: o.modo, destino, valido };
    },
    [items],
  );

  const alEmpezar = useCallback(
    (e: React.PointerEvent, item: GridItem, modo: ModoDeArrastre) => {
      // Solo el boton principal: con el secundario se abre el menu contextual y el arrastre se
      // quedaria pegado al cursor sin que nada lo suelte.
      if (e.button !== 0) return;
      const el = rejilla.current;
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const celda = medirCelda(el, filas);
      origen.current = {
        itemId: item.id,
        modo,
        inicial: item.position,
        x: e.clientX,
        y: e.clientY,
        anchoDeCelda: celda.ancho,
        altoDeCelda: celda.alto,
      };
      setEnCurso({ itemId: item.id, modo, destino: item.position, valido: true });
    },
    [filas, rejilla],
  );

  const alMover = useCallback(
    (e: React.PointerEvent) => {
      const o = origen.current;
      if (!o) return;
      setEnCurso(calcular(o, e.clientX, e.clientY));
    },
    [calcular],
  );

  const alSoltar = useCallback(
    (e: React.PointerEvent) => {
      const o = origen.current;
      origen.current = null;
      if (!o) return;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

      const final = calcular(o, e.clientX, e.clientY);
      setEnCurso(null);

      // Nada que guardar si no se movio o si el destino esta ocupado. Guardar una posicion igual
      // a la actual costaria una ida y vuelta al servidor por cada clic sobre el asa.
      const igual =
        final.destino.x === o.inicial.x &&
        final.destino.y === o.inicial.y &&
        final.destino.w === o.inicial.w &&
        final.destino.h === o.inicial.h;
      if (!final.valido || igual) return;

      onSoltar(o.itemId, final.destino);
    },
    [calcular, onSoltar],
  );

  const alCancelar = useCallback(() => {
    origen.current = null;
    setEnCurso(null);
  }, []);

  return { enCurso, alEmpezar, alMover, alSoltar, alCancelar };
}
