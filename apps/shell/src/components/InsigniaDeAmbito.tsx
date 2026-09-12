'use client';

import { useEffect, useId, useState } from 'react';
import { Icono } from './iconos/Icono';

/**
 * El ambito que impone el RLS, reducido a una insignia.
 *
 * Antes era una frase que enumeraba cada campo y cada valor concedido, a ancho completo y encima
 * del modulo. Con dos dimensiones ya ocupaba una linea entera, y crece con el ambito: la persona
 * cuyo acceso es mas complejo es la que mas texto tiene que saltarse cada vez que abre un
 * modulo, y justo esa persona es la que ya sabe cual es su ambito.
 *
 * Lo que hay que ver SIEMPRE es que la vista esta recortada —porque explica que las cifras no
 * cuadren con las de otro— y eso cabe en tres palabras. El detalle es una consulta puntual, y va
 * detras del puntero.
 *
 * El detalle no se pierde para quien no usa raton: el mismo patron que el tooltip explicativo de
 * los objetos, que cumple 1.4.13 de WCAG —aparece tambien al enfocar con teclado, se cierra con
 * Escape y aguanta el puntero encima para poder leerlo o seleccionarlo.
 */
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
    .map(([campo, valores]) => `${campo} = ${valores.join(', ')}`)
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
