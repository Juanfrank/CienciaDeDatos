'use client';

import { useRef, useState } from 'react';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useTranslator } from './Locale';
import { IconButton } from './icons/IconButton';
import { pedir, motivoDeFallo } from './pedir';

/**
 * Codigo para incrustar esta vista en otro portal — seccion 4.9.
 *
 * El codigo lo GENERA EL SERVIDOR y queda registrado con quien lo pidio. Antes se componia aqui,
 * en el navegador, pegando el slug del modulo y los filtros en una URL: cualquiera que supiera el
 * slug la escribia a mano, y despues no habia forma de responder las dos preguntas que importan
 * cuando un dato de la institucion aparece en la pagina de otro —quien lo puso ahi, y como se
 * quita—. Ahora hay una respuesta a las dos, y un Administrador puede revocarlo.
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
  const t = useTranslator();
  const { searchParams } = useUrlFilters();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [cromo, setCromo] = useState<'completo' | 'limpio'>('completo');
  const [code, setCodigo] = useState('');
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generar = async (cual: 'completo' | 'limpio') => {
    setCromo(cual);
    setCopiado(false);
    setCodigo('');
    setEnCurso(true);
    setError(null);

    // Los filtros que hay AHORA delante: lo que se incrusta es esta vista, no el modulo entero.
    const filtros: Record<string, string[]> = {};
    for (const clave of new Set(searchParams.keys())) {
      filtros[clave] = searchParams.getAll(clave);
    }

    const respuesta = await pedir('/api/embeds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modulo: moduleSlug,
        ...(pageSlug ? { pagina: pageSlug } : {}),
        cromo: cual,
        filtros,
      }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('embed.failed')));
      return;
    }

    const { codigo } = (await respuesta.json()) as { codigo: { code: string } };
    const url = `${window.location.origin}/embed/${codigo.code}`;
    setCodigo(
      [
        `<iframe src="${url}"`,
        `        title="${moduleSlug}"`,
        '        width="100%" height="640" style="border:0"',
        '        allow="" loading="lazy"></iframe>',
      ].join('\n'),
    );
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
      <IconButton
        icono="embed"
        etiqueta={t('embed.action')}
        data-testid="incrustar"
        onClick={() => {
          dialogo.current?.showModal();
          void generar('completo');
        }}
      />

      <dialog
        ref={dialogo}
        className="emergente"
        aria-label={t('embed.title')}
        data-testid="dialogo-incrustar"
      >
        <div className="popover__header">
          <h2>{t('embed.title')}</h2>
          <button
            type="button"
            className="button-link"
            onClick={() => dialogo.current?.close()}
            data-testid="embed-close"
          >
            {t('action.close')}
          </button>
        </div>

        <p className="muted-text">{t('embed.intro')}</p>

        <fieldset className="embed__cromo">
          <legend>{t('embed.what')}</legend>
          <label>
            <input
              type="radio"
              name="cromo"
              value="completo"
              checked={cromo === 'completo'}
              disabled={enCurso}
              data-testid="cromo-completo"
              onChange={() => void generar('completo')}
            />{' '}
            {t('embed.withHeader')}
            <span className="muted-text"> — {t('embed.withHeader.hint')}</span>
          </label>
          <label>
            <input
              type="radio"
              name="cromo"
              value="limpio"
              checked={cromo === 'limpio'}
              disabled={enCurso}
              data-testid="cromo-limpio"
              onChange={() => void generar('limpio')}
            />{' '}
            {t('embed.withoutHeader')}
            <span className="muted-text"> — {t('embed.withoutHeader.hint')}</span>
          </label>
        </fieldset>

        <label className="visualmente-oculto" htmlFor="codigo-incrustacion">
          {t('embed.title')}
        </label>
        <textarea
          id="codigo-incrustacion"
          className="embed__code"
          data-testid="embed-code"
          readOnly
          value={code}
        />

        {error ? (
          <p className="aviso notice-error" role="alert" data-testid="embed-error">
            {error}
          </p>
        ) : null}

        <p className="active-scope" data-testid="embed-notice">
          {t('embed.notice')}
        </p>

        <button
          type="button"
          className="pastilla"
          disabled={enCurso || !code}
          data-testid="incrustar-copiar"
          onClick={() => void copiar()}
        >
          {copiado ? t('embed.copied') : t('embed.copy')}
        </button>
      </dialog>
    </>
  );
}
