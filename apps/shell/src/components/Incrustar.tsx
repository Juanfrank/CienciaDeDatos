'use client';

import { useRef, useState } from 'react';
import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';
import { BotonDeIcono } from './iconos/BotonDeIcono';

/** Codigo para incrustar esta vista en otro portal — seccion 4.9. */
export function Incrustar({ moduleSlug, pageSlug }: { moduleSlug: string; pageSlug?: string }) {
  const { searchParams } = useFiltrosDeUrl();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [copiado, setCopiado] = useState(false);

  const construirCodigo = (): string => {
    const params = new URLSearchParams(searchParams.toString());
    if (pageSlug) params.set('pagina', pageSlug);
    const cadena = params.toString();
    const url = `${window.location.origin}/incrustar/m/${moduleSlug}${cadena ? `?${cadena}` : ''}`;

    return [
      `<iframe src="${url}"`,
      `        title="${moduleSlug}"`,
      '        width="100%" height="640" style="border:0"',
      '        allow="" loading="lazy"></iframe>',
    ].join('\n');
  };

  const [codigo, setCodigo] = useState('');

  const abrir = () => {
    setCodigo(construirCodigo());
    setCopiado(false);
    dialogo.current?.showModal();
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles el texto sigue ahi para seleccionarlo a mano: el dialogo no
      // depende de una API que el navegador puede denegar.
      setCopiado(false);
    }
  };

  return (
    <>
      <BotonDeIcono icono="incrustar" etiqueta="Incrustar" data-testid="incrustar" onClick={abrir} />

      <dialog ref={dialogo} className="emergente" aria-label="Codigo de incrustacion" data-testid="dialogo-incrustar">
        <div className="emergente__cabecera">
          <h2>Incrustar esta vista</h2>
          <button
            type="button"
            className="boton-enlace"
            onClick={() => dialogo.current?.close()}
            data-testid="incrustar-cerrar"
          >
            Cerrar
          </button>
        </div>

        <p className="texto-atenuado">
          Pegue este codigo en el portal. Lleva los filtros que tiene ahora delante.
        </p>

        <label className="visualmente-oculto" htmlFor="codigo-incrustacion">
          Codigo de incrustacion
        </label>
        <textarea
          id="codigo-incrustacion"
          className="incrustar__codigo"
          data-testid="incrustar-codigo"
          readOnly
          value={codigo}
        />

        <p className="ambito-activo" data-testid="incrustar-aviso">
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
