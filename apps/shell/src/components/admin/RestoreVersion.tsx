'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../Locale';

/**
 * Volver a publicar el contenido de una version anterior — seccion 4.5.
 *
 * Pide confirmacion porque cambia lo que ve TODA la institucion, y lo hace con el numero de
 * version escrito en la pregunta: «¿Restaurar?» a secas no dice cual, y en una tabla de doce
 * filas la fila equivocada esta a un pixel de la correcta.
 */
export function RestoreVersion({ slug, version }: { slug: string; version: number }) {
  const router = useRouter();
  const t = useTranslator();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  async function restaurar() {
    setEnCurso(true);
    setError(null);
    const respuesta = await fetch(`/api/modules/${slug}/history`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version }),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setError(cuerpo.error ?? t('admin.history.restoreFailed'));
      return;
    }
    setConfirmando(false);
    router.refresh();
  }

  if (!confirmando) {
    return (
      <>
        <button
          type="button"
          className="button-secundario"
          data-testid={`restore-v${version}`}
          onClick={() => setConfirmando(true)}
        >
          {t('admin.history.restore')}
        </button>
        {error ? (
          <p className="aviso notice-error" data-testid={`restore-error-v${version}`}>
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div role="group" aria-label={t('admin.history.restoreConfirm', { version })}>
      <p className="muted-text">{t('admin.history.restoreWarn', { version })}</p>
      <button
        type="button"
        className="button-primario"
        data-testid={`restore-confirm-v${version}`}
        disabled={enCurso}
        onClick={() => void restaurar()}
      >
        {enCurso ? t('admin.history.restoring') : t('admin.history.restoreConfirm', { version })}
      </button>{' '}
      <button
        type="button"
        className="button-secundario"
        data-testid={`restore-cancel-v${version}`}
        onClick={() => setConfirmando(false)}
      >
        {t('action.cancel')}
      </button>
    </div>
  );
}
