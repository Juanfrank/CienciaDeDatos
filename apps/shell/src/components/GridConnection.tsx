'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConnectionSettings } from '@app/ui-components';
import { Connection, trazar } from './elements';

/** El conector, medido contra la rejilla de verdad. */
export function GridConnection({ config }: { config: ConnectionSettings | undefined }) {
  const ancla = useRef<HTMLDivElement>(null);
  const [puntos, setPuntos] = useState<[number, number][]>([]);

  const desde = config?.desde;
  const hasta = config?.hasta;

  useEffect(() => {
    const el = ancla.current;
    if (!el || !desde || !hasta) {
      setPuntos([]);
      return;
    }
    const rejilla = el.closest('.rejilla');
    if (!rejilla) return;

    const resize = () => {
      const a = rejilla.querySelector(`[data-testid="cell-${CSS.escape(desde)}"]`);
      const b = rejilla.querySelector(`[data-testid="cell-${CSS.escape(hasta)}"]`);
      if (!a || !b) {
        setPuntos([]);
        return;
      }
      const base = rejilla.getBoundingClientRect();
      const box = (node: Element) => {
        const r = node.getBoundingClientRect();
        return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
      };
      setPuntos(trazar(box(a), box(b)).puntos);
    };

    resize();
    // Se observa la REJILLA entera, no las dos cajas: mover un tercer objeto puede empujar a
    // cualquiera de los dos extremos, y observar solo los extremos dejaria el conector desfasado
    // hasta el siguiente render.
    const observador = new ResizeObserver(resize);
    observador.observe(rejilla);
    return () => observador.disconnect();
  }, [desde, hasta]);

  return (
    <div className="conexion-ancla" ref={ancla} data-testid="grid-connection">
      <Connection config={config} puntos={puntos} />
    </div>
  );
}
