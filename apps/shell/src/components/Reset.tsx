'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from './Locale';

/** Restablecimiento de contraseña — seccion 4.7.2. */
export function Reset() {
  const t = useTranslator();
  const router = useRouter();
  const [resetId, setResetId] = useState('');
  const [code, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setError('');

    if (clave !== repetida) {
      // Se comprueba aqui y no en el servidor: no es una regla de seguridad, es evitar que una
      // errata deje a alguien fuera con una contraseña que no sabe cual es.
      setError(t('reset.mismatch'));
      return;
    }

    setEnviando(true);
    try {
      const r = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resetId, code, clave }),
      });

      if (r.ok) {
        setHecho(true);
        return;
      }

      const body = (await r.json()) as { error?: string; detalle?: { message: string }[] };
      const detalle = Array.isArray(body.detalle)
        ? ` ${body.detalle.map((d) => d.message).join(' ')}`
        : '';
      setError(`${body.error ?? t('reset.failed')}${detalle}`);
    } finally {
      setEnviando(false);
    }
  };

  if (hecho) {
    return (
      <main className="pantalla">
        <div className="pantalla__tarjeta">
          <h1>{t('reset.done')}</h1>
          <p className="muted-text">{t('reset.done.detail')}</p>
          <button
            type="button"
            className="pastilla"
            data-testid="reset-ir-a-acceso"
            onClick={() => router.push('/sign-in')}
          >
            {t('reset.signIn')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="pantalla">
      <form
        className="pantalla__tarjeta"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <h1>{t('reset.title')}</h1>
        <p className="muted-text">{t('reset.intro')}</p>

        <p className="form__field">
          <label htmlFor="reset-id">{t('reset.id')}</label>
          <input
            id="reset-id"
            value={resetId}
            data-testid="reset-id"
            onChange={(e) => setResetId(e.target.value)}
          />
        </p>

        <p className="form__field">
          <label htmlFor="reset-code">{t('reset.code')}</label>
          <input
            id="reset-code"
            value={code}
            data-testid="reset-code"
            onChange={(e) => setCodigo(e.target.value)}
          />
        </p>

        <p className="form__field">
          <label htmlFor="reset-clave">{t('reset.newPassword')}</label>
          <input
            id="reset-clave"
            type="password"
            autoComplete="new-password"
            aria-describedby="reset-requisitos"
            value={clave}
            data-testid="reset-key"
            onChange={(e) => setClave(e.target.value)}
          />
          <span id="reset-requisitos" className="muted-text">
            {t('reset.requirements')}
          </span>
        </p>

        <p className="form__field">
          <label htmlFor="reset-repetida">{t('reset.repeat')}</label>
          <input
            id="reset-repetida"
            type="password"
            autoComplete="new-password"
            value={repetida}
            data-testid="reset-repetida"
            onChange={(e) => setRepetida(e.target.value)}
          />
        </p>

        <p className="aviso-error" role="alert" data-testid="reset-error">
          {error}
        </p>

        <button
          type="submit"
          className="pastilla"
          data-testid="reset-send"
          disabled={enviando}
        >
          {enviando ? t('access.checking') : t('reset.submit')}
        </button>
      </form>
    </main>
  );
}
