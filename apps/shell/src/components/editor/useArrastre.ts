'use client';

import { GRID_COLUMNS, seSolapan, type GridItem, type GridPosition } from '@app/module-model';
import { useCallback, useRef, useState } from 'react';

/** Arrastrar para mover y para redimensionar, sobre la rejilla del editor. */

export type ModoDeArrastre = 'mover' | 'redimensionar';

export interface ArrastreEnCurso {
  itemId: string;
  mode: ModoDeArrastre;
  /** Donde caeria si se soltara ahora. */
  destino: GridPosition;
  valido: boolean;
}

interface Origen {
  itemId: string;
  mode: ModoDeArrastre;
  inicial: GridPosition;
  /** Coordenadas del puntero al empezar, para medir el desplazamiento. */
  x: number;
  y: number;
  /** Ancho de una columna, medido del propio lienzo. Las doce miden igual (`1fr`). */
  anchoDeCelda: number;
  /** El hueco entre columnas. */
  hole: number;
  /** Las filas NO miden igual: se guardan las pistas reales. */
  pistas: Pistas;
}

/** Las pistas de la rejilla, tal y como el navegador las resolvio. */
interface Pistas {
  /** Alto resuelto de cada fila, en pixeles. */
  altos: number[];
  /** El hueco entre filas, que tambien cuenta al medir. */
  hole: number;
}

/** Desplazamiento, en pixeles, de la LINEA `i` de la rejilla (0 = borde de arriba del todo). */
function lineaDeFila(p: Pistas, i: number): number {
  const last = p.altos[p.altos.length - 1] ?? 56;
  let y = 0;
  for (let f = 0; f < i; f += 1) y += (p.altos[f] ?? last) + p.hole;
  return y;
}

/** La linea de rejilla mas cercana a `px`. */
function lineaMasCercana(p: Pistas, px: number, maximo: number): number {
  let mejor = 0;
  let distancia = Infinity;
  for (let f = 0; f <= maximo; f += 1) {
    const d = Math.abs(lineaDeFila(p, f) - px);
    if (d >= distancia) break; // monotona: en cuanto se aleja, ya no vuelve a acercarse
    distancia = d;
    mejor = f;
  }
  return mejor;
}

const acotar = (valor: number, minimo: number, maximo: number) =>
  Math.min(maximo, Math.max(minimo, valor));

/** La rejilla, medida de la rejilla real. */
function medirRejilla(rejilla: HTMLElement): { ancho: number; hole: number; pistas: Pistas } {
  const caja = rejilla.getBoundingClientRect();
  const estilo = getComputedStyle(rejilla);
  const huecoX = parseFloat(estilo.columnGap || '0') || 0;
  const huecoY = parseFloat(estilo.rowGap || '0') || 0;
  const altos = estilo.gridTemplateRows
    .split(' ')
    .map((v) => parseFloat(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  return {
    ancho: (caja.width - huecoX * (GRID_COLUMNS - 1)) / GRID_COLUMNS,
    hole: huecoX,
    // Si por lo que sea no hay pistas resueltas, una fila del minimo: se extrapola desde ella y el
    // arrastre sigue funcionando en vez de pegarse a la primera fila.
    pistas: { altos: altos.length ? altos : [56], hole: huecoY },
  };
}

export function useArrastre({
  items,
  rejilla,
  onSoltar,
}: {
  items: GridItem[];
  rejilla: React.RefObject<HTMLDivElement | null>;
  onSoltar: (itemId: string, position: GridPosition) => void;
}) {
  const [enCurso, setEnCurso] = useState<ArrastreEnCurso | null>(null);
  const source = useRef<Origen | null>(null);

  const calcular = useCallback(
    (o: Origen, clienteX: number, clienteY: number): ArrastreEnCurso => {
      const dx = Math.round((clienteX - o.x) / (o.anchoDeCelda + o.hole));
      const arrastradoY = clienteY - o.y;
      // Hasta cuatro filas por debajo de las dibujadas: al soltar, la rejilla crece sola.
      const tope = o.pistas.altos.length + 4;

      let destino: GridPosition;
      if (o.mode === 'mover') {
        // El borde de ARRIBA del bloque busca la linea mas cercana a donde lo han llevado.
        const arriba = lineaDeFila(o.pistas, o.inicial.y) + arrastradoY;
        destino = {
          ...o.inicial,
          x: acotar(o.inicial.x + dx, 0, GRID_COLUMNS - o.inicial.w),
          // Sin tope por abajo: la rejilla crece, y el editor anade filas libres al final.
          y: lineaMasCercana(o.pistas, arriba, tope),
        };
      } else {
        // Al redimensionar lo que se arrastra es el borde de ABAJO; el de arriba no se mueve.
        const abajo = lineaDeFila(o.pistas, o.inicial.y + o.inicial.h) + arrastradoY;
        const line = lineaMasCercana(o.pistas, abajo, tope);
        destino = {
          ...o.inicial,
          w: acotar(o.inicial.w + dx, 1, GRID_COLUMNS - o.inicial.x),
          h: Math.max(1, line - o.inicial.y),
        };
      }

      const valido = !items.some(
        (i) => i.id !== o.itemId && seSolapan(i.position, destino),
      );
      return { itemId: o.itemId, mode: o.mode, destino, valido };
    },
    [items],
  );

  const alEmpezar = useCallback(
    (e: React.PointerEvent, item: GridItem, mode: ModoDeArrastre) => {
      // Solo el boton principal: con el secundario se abre el menu contextual y el arrastre se
      // quedaria pegado al cursor sin que nada lo suelte.
      if (e.button !== 0) return;
      const el = rejilla.current;
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const medida = medirRejilla(el);
      source.current = {
        itemId: item.id,
        mode,
        inicial: item.position,
        x: e.clientX,
        y: e.clientY,
        anchoDeCelda: medida.ancho,
        hole: medida.hole,
        pistas: medida.pistas,
      };
      setEnCurso({ itemId: item.id, mode, destino: item.position, valido: true });
    },
    [rejilla],
  );

  const alMover = useCallback(
    (e: React.PointerEvent) => {
      const o = source.current;
      if (!o) return;
      setEnCurso(calcular(o, e.clientX, e.clientY));
    },
    [calcular],
  );

  const alSoltar = useCallback(
    (e: React.PointerEvent) => {
      const o = source.current;
      source.current = null;
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
    source.current = null;
    setEnCurso(null);
  }, []);

  return { enCurso, alEmpezar, alMover, alSoltar, alCancelar };
}
