'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../icons/Icon';

/** La explicacion de un control, detras de un icono. */
export function Help({ content, de }: { content: string; de: string }) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const envoltorio = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // En captura y cortando la propagacion: el editor tiene su propio Escape, que deselecciona
      // el objeto. Sin esto, cerrar una ayuda vaciaria ademas el panel entero.
      e.stopImmediatePropagation();
      setAbierto(false);
    };
    document.addEventListener('keydown', alPulsarTecla, true);
    return () => document.removeEventListener('keydown', alPulsarTecla, true);
  }, [abierto]);

  return (
    <span
      className="ayuda"
      ref={envoltorio}
      onMouseEnter={() => setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
    >
      <button
        type="button"
        className="help__icon"
        // El nombre dice DE QUE es la ayuda: con seis iconos en el panel, seis botones que dicen
        // «Ayuda» no se distinguen entre si en una lista de controles.
        aria-label={`Que es ${de}`}
        aria-describedby={abierto ? id : undefined}
        aria-expanded={abierto}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        // Con el dedo no hay «pasar por encima»: el toque la abre y la vuelve a cerrar.
        onClick={() => setAbierto((v) => !v)}
      >
        <Icon nombre="informacion" tamano={13} />
      </button>
      {abierto ? (
        <span className="help__globo" id={id} role="tooltip">
          {content}
        </span>
      ) : null}
    </span>
  );
}
