'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConfiguracionDeConexion } from '@app/ui-components';
import { Conexion, trazar } from './elementos';

/**
 * El conector, medido contra la rejilla de verdad.
 *
 * La geometria no se puede calcular en el servidor: solo el navegador sabe donde acabaron las dos
 * cajas despues de que la rejilla repartiera el ancho, y cambia con el tamano de la ventana y con
 * el punto de ruptura. Por eso se mide aqui, y se vuelve a medir cuando algo se mueve.
 *
 * El SVG se dibuja con `position: absolute` desde la celda del propio conector: `.rejilla__celda`
 * no esta posicionada, asi que el ancla es la `.rejilla`, y las coordenadas del trazado son
 * directamente las de la rejilla entera. Sin eso habria que restar el desplazamiento de la celda
 * en cada punto, y el dia que alguien posicionara la celda por otro motivo el conector se iria a
 * otro sitio sin que nada avisara.
 */
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
      const caja = (nodo: Element) => {
        const r = nodo.getBoundingClientRect();
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
