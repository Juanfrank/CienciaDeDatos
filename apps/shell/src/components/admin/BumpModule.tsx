'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../Locale';

/**
 * Subir un objeto a la ultima version dentro de un modulo — seccion 4.5.
 *
 * Pide confirmacion y ensena lo que va a pasar, porque lo que cambia es lo que ve toda la
 * institucion. Despues de hacerlo dice cuantas instancias subieron y, sobre todo, QUE se quedo
 * por el camino: si la version nueva ya no admite una clave que alguien habia configurado, eso no
 * puede enterarse nadie tres semanas mas tarde mirando la pantalla.
 *
 * Traduce por su cuenta, con `useTranslator`, y no recibe las etiquetas ya hechas. Antes las
 * recibia, y tres de ellas eran funciones porque llevan un numero o una lista dentro — y una
 * funcion no cruza de un componente de servidor a uno de cliente: React aborta el renderizado
 * entero con «Functions cannot be passed directly to Client Components». El fallo estuvo desde el
 * primer dia en la pagina de «donde se usa» sin que se notase, porque el boton solo se dibuja en
 * una fila atrasada y ninguna captura ni prueba llego a tener una.
 */
interface Resultado {
  instancias: number;
  preserved: string[];
  retiradas: { instanceId: string; clave: string; valor: unknown }[];
  nuevas: string[];
}

/*
 * Los identificadores de prueba llevan modulo Y objeto.
 *
 * Con el modulo solo bastaba mientras el boton salia una vez por fila en «donde se usa» —ahi la
 * fila ES un modulo—. En la tabla de modulos sale uno por cada objeto atrasado del mismo modulo,
 * y `getByTestId` encontraria varios: una prueba que pulse «el» boton pulsaria el primero que
 * haya, que no tiene por que ser el que la prueba cree.
 */
export function BumpModule({
  slug,
  objectId,
  desde,
  hasta,
}: {
  slug: string;
  objectId: string;
  /** La version que el modulo fija hoy, para poder decir de donde a donde va. */
  desde: string;
  hasta: string;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<Resultado | null>(null);
  const clave = `${slug}-${objectId}`;

  async function subir() {
    setEnCurso(true);
    setError(null);
    const respuesta = await fetch(`/api/modules/${slug}/bump`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ objectId, hasta }),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setError(cuerpo.error ?? t('admin.bump.failed'));
      return;
    }
    setHecho((await respuesta.json()) as Resultado);
    setConfirmando(false);
    router.refresh();
  }

  if (hecho) {
    return (
      <div data-testid={`bump-hecho-${clave}`}>
        <p>{t('admin.bump.done', { n: hecho.instancias, hasta })}</p>
        {hecho.preserved.length > 0 ? (
          <p className="muted-text">
            {t('admin.bump.kept', { claves: t.lista(hecho.preserved) })}
          </p>
        ) : null}
        {hecho.nuevas.length > 0 ? (
          <p className="muted-text">{t('admin.bump.new', { claves: t.lista(hecho.nuevas) })}</p>
        ) : null}
        {hecho.retiradas.length > 0 ? (
          <p className="aviso notice-atencion" data-testid={`bump-retiradas-${clave}`}>
            {t('admin.bump.dropped', { claves: t.lista(hecho.retiradas.map((r) => r.clave)) })}
          </p>
        ) : null}
      </div>
    );
  }

  const aviso = error ? (
    <p className="aviso notice-error" role="alert" data-testid={`bump-error-${clave}`}>
      {error}
    </p>
  ) : null;

  if (!confirmando) {
    return (
      <>
        <button
          type="button"
          className="boton-contorno"
          data-testid={`bump-${clave}`}
          onClick={() => setConfirmando(true)}
        >
          {t('admin.resources.action.bump')}
        </button>
        {aviso}
      </>
    );
  }

  return (
    <div role="group" aria-label={`${t('admin.resources.action.bump')}: ${objectId} · ${slug}`}>
      <p className="muted-text">{t('admin.bump.warn', { desde, hasta })}</p>
      <button
        type="button"
        className="pastilla"
        disabled={enCurso}
        data-testid={`bump-confirm-${clave}`}
        onClick={() => void subir()}
      >
        {enCurso ? t('admin.bump.doing') : t('admin.bump.confirm', { hasta })}
      </button>{' '}
      <button
        type="button"
        className="boton-contorno"
        data-testid={`bump-cancel-${clave}`}
        onClick={() => setConfirmando(false)}
      >
        {t('action.cancel')}
      </button>
      {aviso}
    </div>
  );
}
