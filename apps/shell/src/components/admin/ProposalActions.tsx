'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

/** Aprobar o devolver una propuesta del catalogo — seccion 4.5. */
export function ProposalActions({
  id,
  etiquetas,
}: {
  id: string;
  etiquetas: { aprobar: string; devolver: string; motivo: string; cancelar: string };
}) {
  const router = useRouter();
  const idMotivo = useId();
  const [motivo, setMotivo] = useState('');
  const [devolviendo, setDevolviendo] = useState(false);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decidir(decision: 'aprobar' | 'devolver') {
    setEnCurso(true);
    setError(null);
    const respuesta = await fetch('/api/admin/resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'decidir', id, decision, motivo }),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setError(cuerpo.error ?? 'No se pudo decidir.');
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="fila-acciones">
        <button
          type="button"
          className="pastilla"
          disabled={enCurso}
          data-testid={`aprobar-${id}`}
          onClick={() => void decidir('aprobar')}
        >
          {etiquetas.aprobar}
        </button>
        <button
          type="button"
          className="boton-contorno"
          disabled={enCurso}
          aria-expanded={devolviendo}
          data-testid={`devolver-${id}`}
          onClick={() => setDevolviendo((v) => !v)}
        >
          {etiquetas.devolver}
        </button>
      </p>

      {devolviendo ? (
        <div className="form__field">
          <label htmlFor={idMotivo}>{etiquetas.motivo}</label>
          <textarea
            id={idMotivo}
            rows={2}
            value={motivo}
            data-testid={`devolver-motivo-${id}`}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <p className="fila-acciones">
            <button
              type="button"
              className="pastilla"
              disabled={enCurso || motivo.trim() === ''}
              data-testid={`devolver-confirm-${id}`}
              onClick={() => void decidir('devolver')}
            >
              {etiquetas.devolver}
            </button>
            <button
              type="button"
              className="boton-contorno"
              data-testid={`devolver-cancel-${id}`}
              onClick={() => setDevolviendo(false)}
            >
              {etiquetas.cancelar}
            </button>
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="aviso notice-error" role="alert" data-testid={`propuesta-error-${id}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
