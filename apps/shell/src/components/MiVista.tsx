'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { BotonDeIcono } from './iconos/BotonDeIcono';

/**
 * Personalizacion de la vista — seccion 4.6.
 *
 * "Personalizacion limitada a la capa de PRESENTACION (campos visibles dentro de una perspectiva
 * aprobada, orden, layout) — NUNCA a la logica de calculo de la metrica."
 *
 * De ahi que aqui solo se marque QUE OBJETOS SE VEN. No hay nada que permita cambiar una medida,
 * ni un filtro que se guarde como parte de la vista: los filtros viven en la URL (4.11) y son
 * otra cosa, que se comparte con un marcador y no altera la vista de nadie.
 *
 * La lista se pide al abrir el dialogo y no viene con la pagina, porque tiene que enumerar los
 * objetos del modulo INSTITUCIONAL: los que la persona oculto ya no estan en lo que ve, y sin
 * esa lista no habria forma de volver a mostrarlos.
 */
export function MiVista({
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

  const abrir = async () => {
    setError('');
    const r = await fetch(`/api/modulos/${moduleSlug}/vista`);
    if (!r.ok) return;
    const cuerpo = (await r.json()) as {
      ocultos: string[];
      objetos: { id: string; titulo: string }[];
    };
    setObjetos(cuerpo.objetos);
    setOcultos(cuerpo.ocultos);
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

  const descartar = async () => {
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
      <BotonDeIcono
        icono="vista"
        etiqueta="Mi vista"
        presionado={personalizada}
        data-testid="mi-vista"
        onClick={() => void abrir()}
      />

      <dialog ref={dialogo} className="emergente" aria-label="Mi vista" data-testid="dialogo-mi-vista">
        <div className="emergente__cabecera">
          <h2>Mi vista de este modulo</h2>
          <button
            type="button"
            className="boton-enlace"
            data-testid="mi-vista-cerrar"
            onClick={() => dialogo.current?.close()}
          >
            Cerrar
          </button>
        </div>

        <p className="texto-atenuado">
          Elija que objetos quiere ver. Esto cambia solo SU vista y no la de nadie mas, y no
          altera lo que mide ningun indicador (4.6).
        </p>

        <fieldset className="mi-vista__objetos">
          <legend>Objetos visibles</legend>
          {objetos.map((o) => (
            <label key={o.id}>
              <input
                type="checkbox"
                data-testid={`ver-${o.id}`}
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

        <p className="acceso__error" role="alert" data-testid="mi-vista-error">
          {error}
        </p>

        <div className="emergente__acciones">
          <button
            type="button"
            className="pastilla"
            data-testid="mi-vista-guardar"
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
              className="boton-enlace"
              data-testid="mi-vista-descartar"
              disabled={trabajando}
              onClick={() => void descartar()}
            >
              Volver a la vista institucional
            </button>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
