'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icono, type IconName } from '../iconos/Icono';

/** La barra de pestanas del panel, con paginado. */

export interface DefinicionDePestana<T extends string> {
  id: T;
  etiqueta: string;
  icono: IconName;
  habilitada: boolean;
}

export function Pestanas<T extends string>({
  tabs,
  activa,
  onElegir,
}: {
  tabs: DefinicionDePestana<T>[];
  activa: T;
  onElegir: (id: T) => void;
}) {
  const carril = useRef<HTMLDivElement>(null);
  const [desbordaIzquierda, setDesbordaIzquierda] = useState(false);
  const [desbordaDerecha, setDesbordaDerecha] = useState(false);

  const medir = useCallback(() => {
    const el = carril.current;
    if (!el) return;
    // Un pixel de margen: los navegadores devuelven valores fraccionarios al escalar, y sin el
    // margen el chevron derecho parpadea en anchos donde todo cabe justo.
    setDesbordaIzquierda(el.scrollLeft > 1);
    setDesbordaDerecha(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    medir();
    const el = carril.current;
    if (!el) return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [medir, tabs.length]);

  const desplazar = (signo: 1 | -1) => {
    const el = carril.current;
    if (!el) return;
    el.scrollBy({ left: signo * Math.max(80, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  const alPulsarTecla = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const posibles = tabs.filter((p) => p.habilitada);
    const actual = posibles.findIndex((p) => p.id === activa);
    const paso = e.key === 'ArrowRight' ? 1 : -1;
    const siguiente = posibles[(actual + paso + posibles.length) % posibles.length];
    if (!siguiente) return;
    onElegir(siguiente.id);
    const boton = carril.current?.querySelector<HTMLButtonElement>(
      `[data-pestana='${siguiente.id}']`,
    );
    boton?.focus();
    // `nearest` y no `center`: centrar salta la barra entera aunque la pestana ya se vea.
    boton?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div className="panel-editor__barra">
      {desbordaIzquierda ? (
        <Chevron hacia="izquierda" onPulsar={() => desplazar(-1)} />
      ) : null}

      <div
        className="panel-editor__pestanas"
        role="tablist"
        aria-label="Herramientas del editor"
        ref={carril}
        onScroll={medir}
        onKeyDown={alPulsarTecla}
      >
        {tabs.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`pestana-${p.id}`}
            data-pestana={p.id}
            aria-selected={activa === p.id}
            aria-controls={`panel-${p.id}`}
            tabIndex={activa === p.id ? 0 : -1}
            disabled={!p.habilitada}
            className="panel-editor__pestana"
            data-testid={`pestana-${p.id}`}
            onClick={() => onElegir(p.id)}
          >
            <Icono nombre={p.icono} tamano={18} />
            <span>{p.etiqueta}</span>
          </button>
        ))}
      </div>

      {desbordaDerecha ? <Chevron hacia="derecha" onPulsar={() => desplazar(1)} /> : null}
    </div>
  );
}

function Chevron({ hacia, onPulsar }: { hacia: 'izquierda' | 'derecha'; onPulsar: () => void }) {
  return (
    <button
      type="button"
      className="panel-editor__chevron"
      // Fuera del `tablist` y con `tabIndex={-1}`: desplazar la barra no es navegar entre
      // pestanas, y quien usa teclado ya llega a todas con las flechas. Un boton mas en el
      // recorrido solo anadiria una parada que no hace falta.
      tabIndex={-1}
      aria-hidden="true"
      data-testid={`pestanas-${hacia}`}
      onClick={onPulsar}
    >
      {hacia === 'izquierda' ? '‹' : '›'}
    </button>
  );
}
