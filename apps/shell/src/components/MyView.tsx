'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { IconButton } from './icons/IconButton';

/** Personalizacion de la vista — seccion 4.6. */
export function MyView({
  moduleSlug,
  personalizada,
}: {
  moduleSlug: string;
  personalizada: boolean;
}) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [objetos, setObjetos] = useState<{ id: string; titulo: string }[]>([]);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const open = async () => {
    setError('');
    const r = await fetch(`/api/modulos/${moduleSlug}/vista`);
    if (!r.ok) return;
    const body = (await r.json()) as {
      ocultos: string[];
      objetos: { id: string; titulo: string }[];
    };
    setObjetos(body.objetos);
    setOcultos(body.ocultos);
    dialogo.current?.showModal();
  };

  const guardar = async () => {
    setError('');
    setTrabajando(true);
    try {
      const r = await fetch(`/api/modulos/${moduleSlug}/vista`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ocultos }),
      });
      if (!r.ok) {
        setError(((await r.json()) as { error?: string }).error ?? 'No se pudo guardar.');
        return;
      }
      dialogo.current?.close();
      router.refresh();
    } finally {
      setTrabajando(false);
    }
  };

  const discard = async () => {
    setError('');
    setTrabajando(true);
    try {
      await fetch(`/api/modulos/${moduleSlug}/vista`, { method: 'DELETE' });
      dialogo.current?.close();
      router.refresh();
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <>
      <IconButton
        icono="view"
        etiqueta="Mi vista"
        presionado={personalizada}
        data-testid="my-view"
        onClick={() => void open()}
      />

      <dialog ref={dialogo} className="emergente" aria-label="Mi vista" data-testid="dialogo-my-view">
        <div className="popover__header">
          <h2>Mi vista de este modulo</h2>
          <button
            type="button"
            className="button-link"
            data-testid="my-view-close"
            onClick={() => dialogo.current?.close()}
          >
            Cerrar
          </button>
        </div>

        <p className="muted-text">
          Elija que objetos quiere ver. Esto cambia solo SU view y no la de nadie mas, y no
          altera lo que mide ningun indicador (4.6).
        </p>

        <fieldset className="my-view__objects">
          <legend>Objetos visibles</legend>
          {objetos.map((o) => (
            <label key={o.id}>
              <input
                type="checkbox"
                data-testid={`see-${o.id}`}
                checked={!ocultos.includes(o.id)}
                onChange={(e) =>
                  setOcultos((actuales) =>
                    e.target.checked ? actuales.filter((id) => id !== o.id) : [...actuales, o.id],
                  )
                }
              />{' '}
              {o.titulo}
            </label>
          ))}
        </fieldset>

        <p className="login__error" role="alert" data-testid="my-view-error">
          {error}
        </p>

        <div className="popover__actions">
          <button
            type="button"
            className="pastilla"
            data-testid="my-view-save"
            disabled={trabajando}
            onClick={() => void guardar()}
          >
            Guardar mi vista
          </button>

          {/*
            La salida siempre esta a mano. Una vista personalizada de la que no se pueda volver a
            la oficial es una vista rota, y 4.6 deja claro que la definicion institucional sigue
            siendo la fuente de verdad.
          */}
          {personalizada ? (
            <button
              type="button"
              className="button-link"
              data-testid="my-view-descartar"
              disabled={trabajando}
              onClick={() => void discard()}
            >
              Volver a la vista institucional
            </button>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
