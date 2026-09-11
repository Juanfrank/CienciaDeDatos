'use client';

import { useEffect, useState } from 'react';
import { GRID_COLUMNS, type Breakpoint, layoutForBreakpoint } from '@app/module-model';

/**
 * Rejilla responsiva — seccion 4.2.
 *
 * La disposicion guardada es SIEMPRE la de doce columnas; lo que se ve en una pantalla estrecha
 * se deriva de ella con `layoutForBreakpoint`, que ya esta probado. Aqui solo se decide que
 * tamano aplica y se traduce a CSS Grid.
 */
function breakpointDe(ancho: number): Breakpoint {
  if (ancho < 640) return 'movil';
  if (ancho < 1024) return 'tableta';
  return 'escritorio';
}

export function Rejilla({
  items,
  children,
}: {
  items: { id: string; position: { x: number; y: number; w: number; h: number } }[];
  children: (id: string) => React.ReactNode;
}) {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('escritorio');

  useEffect(() => {
    const actualizar = () => setBreakpoint(breakpointDe(window.innerWidth));
    actualizar();
    window.addEventListener('resize', actualizar);
    return () => window.removeEventListener('resize', actualizar);
  }, []);

  const dispuestos = layoutForBreakpoint(items, breakpoint);
  const columnas = breakpoint === 'movil' ? 1 : breakpoint === 'tableta' ? 6 : GRID_COLUMNS;

  return (
    <div
      className="rejilla"
      data-breakpoint={breakpoint}
      style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
    >
      {dispuestos.map((item) => (
        <div
          key={item.id}
          className="rejilla__celda"
          style={{
            gridColumn: `${item.position.x + 1} / span ${item.position.w}`,
            gridRow: `span ${item.position.h}`,
          }}
        >
          {children(item.id)}
        </div>
      ))}
    </div>
  );
}
