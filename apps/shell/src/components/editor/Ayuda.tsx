'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icono } from '../iconos/Icono';

/**
 * La explicacion de un control, detras de un icono.
 *
 * Estaba como parrafo debajo de cada rotulo — «La dimension que reparte las barras», «Opcional.
 * Agrupa las barras de cada categoria» — y en un panel de 340 px eso es media pantalla de texto
 * que se lee una vez y estorba siempre despues. La explicacion sigue haciendo falta la primera
 * vez; lo que no hace falta es tenerla delante la vez ciento.
 *
 * Tres reglas de 1.4.13, que es el criterio que gobierna cualquier cosa que aparezca al pasar por
 * encima, y que un `title` del navegador NO cumple:
 *
 *  - **Se descarta**: Escape la cierra sin mover el puntero.
 *  - **Se puede senalar**: el raton puede entrar en el globo sin que desaparezca —por eso el
 *    `onMouseLeave` va en el envoltorio y no en el boton—, que es lo que permite seleccionar el
 *    texto o leerlo con una lupa.
 *  - **Persiste**: se va cuando se va el foco o el puntero, nunca sola por tiempo.
 *
 * Es un boton y no un `<span>` con `title` porque tiene que alcanzarse con el tabulador: quien
 * navega con teclado necesita llegar a la explicacion igual que quien usa raton.
 */
export function Ayuda({ texto, de }: { texto: string; de: string }) {
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
        className="ayuda__icono"
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
        <Icono nombre="informacion" tamano={13} />
      </button>
      {abierto ? (
        <span className="ayuda__globo" id={id} role="tooltip">
          {texto}
        </span>
      ) : null}
    </span>
  );
}
