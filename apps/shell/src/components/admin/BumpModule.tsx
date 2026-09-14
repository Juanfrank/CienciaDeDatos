'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Subir un objeto a la ultima version dentro de un modulo — seccion 4.5.
 *
 * Pide confirmacion y ensena lo que va a pasar, porque lo que cambia es lo que ve toda la
 * institucion. Despues de hacerlo dice cuantas instancias subieron y, sobre todo, QUE se quedo
 * por el camino: si la version nueva ya no admite una clave que alguien habia configurado, eso no
 * puede enterarse nadie tres semanas mas tarde mirando la pantalla.
 */
interface Resultado {
  instancias: number;
  preserved: string[];
  retiradas: { instanceId: string; clave: string; valor: unknown }[];
  nuevas: string[];
}

export function BumpModule({
  slug,
  objectId,
  hasta,
  etiquetas,
}: {
  slug: string;
  objectId: string;
  hasta: string;
  etiquetas: {
    subir: string;
    aviso: string;
    confirmar: string;
    subiendo: string;
    cancelar: string;
    hecho: (n: number) => string;
    conserva: (claves: string) => string;
    nuevas: (claves: string) => string;
    retiradas: (claves: string) => string;
    fallo: string;
  };
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<Resultado | null>(null);

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
      setError(cuerpo.error ?? etiquetas.fallo);
      return;
    }
    setHecho((await respuesta.json()) as Resultado);
    setConfirmando(false);
    router.refresh();
  }

  if (hecho) {
    return (
      <div data-testid={`bump-hecho-${slug}`}>
        <p>{etiquetas.hecho(hecho.instancias)}</p>
        {hecho.preserved.length > 0 ? (
          <p className="muted-text">{etiquetas.conserva(hecho.preserved.join(', '))}</p>
        ) : null}
        {hecho.nuevas.length > 0 ? (
          <p className="muted-text">{etiquetas.nuevas(hecho.nuevas.join(', '))}</p>
        ) : null}
        {hecho.retiradas.length > 0 ? (
          <p className="aviso notice-atencion" data-testid={`bump-retiradas-${slug}`}>
            {etiquetas.retiradas(hecho.retiradas.map((r) => r.clave).join(', '))}
          </p>
        ) : null}
      </div>
    );
  }

  if (!confirmando) {
    return (
      <>
        <button
          type="button"
          className="boton-contorno"
          data-testid={`bump-${slug}`}
          onClick={() => setConfirmando(true)}
        >
          {etiquetas.subir}
        </button>
        {error ? (
          <p className="aviso notice-error" role="alert" data-testid={`bump-error-${slug}`}>
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div role="group" aria-label={`${etiquetas.subir}: ${slug}`}>
      <p className="muted-text">{etiquetas.aviso}</p>
      <button
        type="button"
        className="pastilla"
        disabled={enCurso}
        data-testid={`bump-confirm-${slug}`}
        onClick={() => void subir()}
      >
        {enCurso ? etiquetas.subiendo : etiquetas.confirmar}
      </button>{' '}
      <button
        type="button"
        className="boton-contorno"
        data-testid={`bump-cancel-${slug}`}
        onClick={() => setConfirmando(false)}
      >
        {etiquetas.cancelar}
      </button>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid={`bump-error-${slug}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
