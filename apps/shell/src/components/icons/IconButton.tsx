'use client';

import { forwardRef } from 'react';
import { Icon, type IconName } from './Icon';

/** Boton que solo muestra un icono. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  {
    icono: IconName;
    etiqueta: string;
    contador?: number;
    presionado?: boolean;
    onClick: () => void;
  } & { 'data-testid'?: string }
>(function IconButton({ icono, etiqueta, contador, presionado, onClick, ...resto }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className="icon-button"
      aria-label={contador === undefined ? etiqueta : `${etiqueta} (${contador})`}
      title={etiqueta}
      {...(presionado === undefined ? {} : { 'aria-pressed': presionado })}
      onClick={onClick}
      {...resto}
    >
      <Icon nombre={icono} />
      {contador !== undefined && contador > 0 ? (
        <span className="icon-button__contador" aria-hidden="true">
          {contador}
        </span>
      ) : null}
    </button>
  );
});
