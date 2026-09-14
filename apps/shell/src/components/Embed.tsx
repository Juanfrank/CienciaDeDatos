'use client';

import { useRef, useState } from 'react';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { IconButton } from './icons/IconButton';

/**
 * Codigo para incrustar esta vista en otro portal — seccion 4.9.
 *
 * Dos formas, y la diferencia no es cosmetica. CON ENCABEZADO lleva el emblema y el nombre de la
 * institucion: es lo que se pone en un portal ajeno, donde la vista tiene que decir de donde salen
 * los datos. SIN ENCABEZADO no lleva ninguno de los dos y tampoco el enlace de salida: es para
 * incrustarla dentro de un sistema que YA es del Poder Judicial, como una pieza mas de su pantalla.
 *
 * Lo que se conserva en las dos es QUIEN MIRA. Lo que se ve depende del ambito de quien tiene la
 * sesion abierta, asi que una vista que no diga con que identidad esta dibujada invita a leerla
 * como si fuera la de todo el mundo.
 */
export function Embed({ moduleSlug, pageSlug }: { moduleSlug: string; pageSlug?: string }) {
  const { searchParams } = useUrlFilters();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [cromo, setCromo] = useState<'completo' | 'limpio'>('completo');

  const buildCode = (cual: 'completo' | 'limpio'): string => {
    const params = new URLSearchParams(searchParams.toString());
    if (pageSlug) params.set('pagina', pageSlug);
    if (cual === 'limpio') params.set('cromo', 'limpio');
    const cadena = params.toString();
    const url = `${window.location.origin}/embed/m/${moduleSlug}${cadena ? `?${cadena}` : ''}`;

    return [
      `<iframe src="${url}"`,
      `        title="${moduleSlug}"`,
      '        width="100%" height="640" style="border:0"',
      '        allow="" loading="lazy"></iframe>',
    ].join('\n');
  };

  const [code, setCodigo] = useState('');

  const elegir = (cual: 'completo' | 'limpio') => {
    setCromo(cual);
    setCodigo(buildCode(cual));
    setCopiado(false);
  };

  const open = () => {
    setCromo('completo');
    setCodigo(buildCode('completo'));
    setCopiado(false);
    dialogo.current?.showModal();
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles el texto sigue ahi para seleccionarlo a mano: el dialogo no
      // depende de una API que el navegador puede denegar.
      setCopiado(false);
    }
  };

  return (
    <>
      <IconButton icono="embed" etiqueta="Incrustar" data-testid="incrustar" onClick={open} />

      <dialog ref={dialogo} className="emergente" aria-label="Codigo de incrustacion" data-testid="dialogo-incrustar">
        <div className="popover__header">
          <h2>Incrustar esta vista</h2>
          <button
            type="button"
            className="button-link"
            onClick={() => dialogo.current?.close()}
            data-testid="embed-close"
          >
            Cerrar
          </button>
        </div>

        <p className="muted-text">
          Pegue este codigo en el portal. Lleva los filtros que tiene ahora delante.
        </p>

        <fieldset className="embed__cromo">
          <legend>Que se incrusta</legend>
          <label>
            <input
              type="radio"
              name="cromo"
              value="completo"
              checked={cromo === 'completo'}
              data-testid="cromo-completo"
              onChange={() => elegir('completo')}
            />{' '}
            Con el encabezado institucional
            <span className="muted-text">
              {' '}
              — el emblema y el nombre. Para un portal de otra institucion.
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="cromo"
              value="limpio"
              checked={cromo === 'limpio'}
              data-testid="cromo-limpio"
              onChange={() => elegir('limpio')}
            />{' '}
            Sin encabezado
            <span className="muted-text">
              {' '}
              — solo el modulo y quien lo mira, y sin salida a la aplicacion. Para incrustarlo
              dentro de un sistema del propio Poder Judicial.
            </span>
          </label>
        </fieldset>

        <label className="visualmente-oculto" htmlFor="codigo-incrustacion">
          Codigo de incrustacion
        </label>
        <textarea
          id="codigo-incrustacion"
          className="embed__code"
          data-testid="embed-code"
          readOnly
          value={code}
        />

        <p className="active-scope" data-testid="embed-notice">
          Quien vea el portal tiene que haber iniciado sesion aqui, y vera los datos que su propio
          ambito de acceso permita — nunca los del equipo de quien incrusto la vista. El portal
          anfitrion tambien debe estar autorizado por un Administrador.
        </p>

        <button type="button" className="pastilla" data-testid="incrustar-copiar" onClick={() => void copiar()}>
          {copiado ? 'Copiado' : 'Copiar codigo'}
        </button>
      </dialog>
    </>
  );
}
