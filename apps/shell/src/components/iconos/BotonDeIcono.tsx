'use client';

import { forwardRef } from 'react';
import { Icono, type NombreDeIcono } from './Icono';

/**
 * Boton que solo muestra un icono.
 *
 * La etiqueta NO desaparece: viaja en `aria-label`, asi que un lector de pantalla anuncia
 * exactamente lo mismo que antes decia el texto del boton, y en `title`, para que quien mire con
 * los ojos pueda recuperarla pasando el raton. Un icono sin nombre accesible es un boton que no
 * se puede nombrar ni por voz ni con un lector, y ninguna prueba de axe lo deja pasar.
 *
 * `contador` existe para el unico caso en el que el icono no basta: cuantos marcadores hay. Es
 * una cifra, no un estado, y esconderla detras del raton la haria inutil.
 */
export const BotonDeIcono = forwardRef<
  HTMLButtonElement,
  {
    icono: NombreDeIcono;
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
