'use client';

import { forwardRef } from 'react';
import { Icono, type IconName } from './Icono';

/** Boton que solo muestra un icono. */
export const BotonDeIcono = forwardRef<
  HTMLButtonElement,
  {
    icono: IconName;
    etiqueta: string;
    contador?: number;
    presionado?: boolean;
    onClick: () => void;
  } & { 'data-testid'?: string }
>(function BotonDeIcono({ icono, etiqueta, contador, presionado, onClick, ...resto }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className="boton-icono"
      aria-label={contador === undefined ? etiqueta : `${etiqueta} (${contador})`}
      title={etiqueta}
      {...(presionado === undefined ? {} : { 'aria-pressed': presionado })}
      onClick={onClick}
      {...resto}
    >
      <Icono nombre={icono} />
      {contador !== undefined && contador > 0 ? (
        <span className="boton-icono__contador" aria-hidden="true">
          {contador}
        </span>
      ) : null}
    </button>
  );
});
