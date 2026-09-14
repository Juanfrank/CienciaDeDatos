'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../icons/Icon';

/** La barra de pestanas del panel, con paginado. */

export interface DefinicionDePestana<T extends string> {
  id: T;
  etiqueta: string;
  icono: IconName;
  habilitada: boolean;
}

export function Tabs<T extends string>({
  tabs,
  activa,
  onElegir,
}: {
  tabs: DefinicionDePestana<T>[];
  activa: T;
  onElegir: (id: T) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [desbordaIzquierda, setDesbordaIzquierda] = useState(false);
  const [desbordaDerecha, setDesbordaDerecha] = useState(false);

  const resize = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    // Un pixel de margen: los navegadores devuelven valores fraccionarios al escalar, y sin el
    // margen el chevron derecho parpadea en anchos donde todo cabe justo.
    setDesbordaIzquierda(el.scrollLeft > 1);
    setDesbordaDerecha(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    resize();
    const el = rail.current;
    if (!el) return;
    const observador = new ResizeObserver(resize);
    observador.observe(el);
    return () => observador.disconnect();
  }, [resize, tabs.length]);

  const shift = (signo: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: signo * Math.max(80, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  const alPulsarTecla = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const possible = tabs.filter((p) => p.habilitada);
    const actual = possible.findIndex((p) => p.id === activa);
    const paso = e.key === 'ArrowRight' ? 1 : -1;
    const siguiente = possible[(actual + paso + possible.length) % possible.length];
    if (!siguiente) return;
    onElegir(siguiente.id);
    const button = rail.current?.querySelector<HTMLButtonElement>(
      `[data-tab='${siguiente.id}']`,
    );
    button?.focus();
    // `nearest` y no `center`: centrar salta la barra entera aunque la pestana ya se vea.
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div className="editor-panel__bar">
      {desbordaIzquierda ? (
        <Chevron hacia="izquierda" onPulsar={() => shift(-1)} />
      ) : null}

      <div
        className="editor-panel__tabs"
        role="tablist"
        aria-label="Herramientas del editor"
        ref={rail}
        onScroll={resize}
        onKeyDown={alPulsarTecla}
      >
        {tabs.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`pestana-${p.id}`}
            data-tab={p.id}
            aria-selected={activa === p.id}
            aria-controls={`panel-${p.id}`}
            tabIndex={activa === p.id ? 0 : -1}
            disabled={!p.habilitada}
            className="editor-panel__tab"
            data-testid={`tab-${p.id}`}
            onClick={() => onElegir(p.id)}
          >
            <Icon nombre={p.icono} tamano={18} />
            <span>{p.etiqueta}</span>
          </button>
        ))}
      </div>

      {desbordaDerecha ? <Chevron hacia="derecha" onPulsar={() => shift(1)} /> : null}
    </div>
  );
}

function Chevron({ hacia, onPulsar }: { hacia: 'izquierda' | 'derecha'; onPulsar: () => void }) {
  return (
    <button
      type="button"
      className="editor-panel__chevron"
      // Fuera del `tablist` y con `tabIndex={-1}`: desplazar la barra no es navegar entre
      // pestanas, y quien usa teclado ya llega a todas con las flechas. Un boton mas en el
      // recorrido solo anadiria una parada que no hace falta.
      tabIndex={-1}
      aria-hidden="true"
      data-testid={`tabs-${hacia}`}
      onClick={onPulsar}
    >
      {hacia === 'izquierda' ? '‹' : '›'}
    </button>
  );
}
