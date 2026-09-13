'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConfiguracionDeConexion } from '@app/ui-components';
import { Conexion, trazar } from './elementos';

/** El conector, medido contra la rejilla de verdad. */
export function ConexionEnRejilla({ config }: { config: ConfiguracionDeConexion | undefined }) {
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

    const medir = () => {
      const a = rejilla.querySelector(`[data-testid="celda-${CSS.escape(desde)}"]`);
      const b = rejilla.querySelector(`[data-testid="celda-${CSS.escape(hasta)}"]`);
      if (!a || !b) {
        setPuntos([]);
        return;
      }
      const base = rejilla.getBoundingClientRect();
      const caja = (node: Element) => {
        const r = node.getBoundingClientRect();
        return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
      };
      setPuntos(trazar(caja(a), caja(b)).puntos);
    };

    medir();
    // Se observa la REJILLA entera, no las dos cajas: mover un tercer objeto puede empujar a
    // cualquiera de los dos extremos, y observar solo los extremos dejaria el conector desfasado
    // hasta el siguiente render.
    const observador = new ResizeObserver(medir);
    observador.observe(rejilla);
    return () => observador.disconnect();
  }, [desde, hasta]);

  return (
    <div className="conexion-ancla" ref={ancla} data-testid="conexion-en-rejilla">
      <Conexion config={config} puntos={puntos} />
    </div>
  );
}
