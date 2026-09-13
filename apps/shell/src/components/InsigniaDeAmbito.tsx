'use client';

import { useEffect, useId, useState } from 'react';
import { Icono } from './iconos/Icono';

/** El ambito que impone el RLS, reducido a una insignia. */
export function InsigniaDeAmbito({ restricciones }: { restricciones: [string, string[]][] }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [visible]);

  if (restricciones.length === 0) return null;

  const detalle = restricciones
    .map(([fieldName, valores]) => `${fieldName} = ${valores.join(', ')}`)
    .join(' · ');

  return (
    <span
      className="ambito"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        className="insignia insignia--ambito"
        aria-describedby={visible ? id : undefined}
        data-testid="ambito-activo"
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
      >
        <Icono nombre="ambito" tamano={14} />
        Ambito limitado por RLS
      </button>

      {visible ? (
        <span role="tooltip" id={id} className="ambito__detalle" data-testid="ambito-detalle">
          Su ambito de acceso limita esta vista a: {detalle}
        </span>
      ) : null}
    </span>
  );
}
