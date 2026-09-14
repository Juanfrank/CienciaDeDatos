'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useTranslator } from '../Locale';

/**
 * Aprobar o devolver una propuesta, desde el panel.
 *
 * El motivo de la devolucion se pedia con `window.prompt`. Es un dialogo del navegador: no se
 * estiliza, no lleva etiqueta asociada, no respeta el tema, algunos navegadores lo bloquean, y
 * un lector de pantalla lo anuncia como una interrupcion sin contexto. La seccion 4.9 dice que
 * la accesibilidad no es opcional y no se pospone, asi que es un campo de verdad, con su
 * `<label>`, dentro de la pagina.
 */
export function ReviewActions({ slug, publicable }: { slug: string; publicable: boolean }) {
  const router = useRouter();
  const t = useTranslator();
  const idMotivo = useId();
  const [motivo, setMotivo] = useState('');
  const [devolviendo, setDevolviendo] = useState(false);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transicion(cual: 'publicar' | 'devolver') {
    setEnCurso(true);
    setError(null);
    const respuesta = await fetch(`/api/modules/${slug}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transition: cual, ...(cual === 'devolver' ? { motivo } : {}) }),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setError(cuerpo.error ?? t('admin.review.failed'));
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p>
        <button
          type="button"
          className="pastilla"
          data-testid={`approve-${slug}`}
          disabled={enCurso || !publicable}
          onClick={() => void transicion('publicar')}
        >
          {t('admin.review.publish')}
        </button>{' '}
        <button
          type="button"
          className="boton-contorno"
          data-testid={`return-${slug}`}
          disabled={enCurso}
          onClick={() => setDevolviendo((v) => !v)}
          aria-expanded={devolviendo}
        >
          {t('admin.review.return')}
        </button>
      </p>

      {devolviendo ? (
        <div className="form__field">
          <label htmlFor={idMotivo}>{t('admin.review.reason')}</label>
          <textarea
            id={idMotivo}
            rows={3}
            value={motivo}
            data-testid={`return-reason-${slug}`}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <p>
            <button
              type="button"
              className="pastilla"
              data-testid={`return-confirm-${slug}`}
              /* Se deshabilita por lo mismo que lo exige el servidor: sin motivo, quien lo
                 propuso no sabe que arreglar. */
              disabled={enCurso || motivo.trim() === ''}
              onClick={() => void transicion('devolver')}
            >
              {t('admin.review.returnConfirm')}
            </button>{' '}
            <button
              type="button"
              className="boton-contorno"
              data-testid={`return-cancel-${slug}`}
              onClick={() => setDevolviendo(false)}
            >
              {t('action.cancel')}
            </button>
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="aviso notice-error" role="alert" data-testid={`review-error-${slug}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
