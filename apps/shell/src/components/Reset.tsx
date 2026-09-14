'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Restablecimiento de contraseña — seccion 4.7.2. */
export function Reset() {
  const router = useRouter();
  const [resetId, setResetId] = useState('');
  const [codigo, setCodigo] = useState('');
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
      setError('Las dos contrasenas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      const r = await fetch('/api/restablecer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resetId, codigo, clave }),
      });

      if (r.ok) {
        setHecho(true);
        return;
      }

      const body = (await r.json()) as { error?: string; detalle?: { message: string }[] };
      const detalle = Array.isArray(body.detalle)
        ? ` ${body.detalle.map((d) => d.message).join(' ')}`
        : '';
      setError(`${body.error ?? 'No se pudo restablecer la contrasena.'}${detalle}`);
    } finally {
      setEnviando(false);
    }
  };

  if (hecho) {
    return (
      <main className="acceso">
        <div className="login__card">
          <h1>Contrasena restablecida</h1>
          <p className="muted-text">
            Ya puede iniciar sesion con la contrasena new y su codigo de verificacion. Las
            sesiones que estuvieran abiertas con la anterior se han cerrado.
          </p>
          <button
            type="button"
            className="pastilla"
            data-testid="reset-ir-a-acceso"
            onClick={() => router.push('/acceso')}
          >
            Iniciar sesion
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="acceso">
      <form
        className="login__card"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <h1>Restablecer contrasena</h1>
        <p className="muted-text">
          Con el identificador y el codigo que le entrego un Administrador. El codigo solo sirve
          una vez y caduca a los quince minutos.
        </p>

        <p className="form__field">
          <label htmlFor="reset-id">Identificador del restablecimiento</label>
          <input
            id="reset-id"
            value={resetId}
            data-testid="reset-id"
            onChange={(e) => setResetId(e.target.value)}
          />
        </p>

        <p className="form__field">
          <label htmlFor="reset-codigo">Codigo</label>
          <input
            id="reset-codigo"
            value={codigo}
            data-testid="reset-codigo"
            onChange={(e) => setCodigo(e.target.value)}
          />
        </p>

        <p className="form__field">
          <label htmlFor="reset-clave">Contrasena new</label>
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
            Al menos 12 caracteres, con mayuscula, minuscula, digito y simbolo. No puede ser
            ninguna de sus ultimas cinco contrasenas.
          </span>
        </p>

        <p className="form__field">
          <label htmlFor="reset-repetida">Repita la contrasena new</label>
          <input
            id="reset-repetida"
            type="password"
            autoComplete="new-password"
            value={repetida}
            data-testid="reset-repetida"
            onChange={(e) => setRepetida(e.target.value)}
          />
        </p>

        <p className="login__error" role="alert" data-testid="reset-error">
          {error}
        </p>

        <button
          type="submit"
          className="pastilla"
          data-testid="reset-send"
          disabled={enviando}
        >
          {enviando ? 'Comprobando…' : 'Restablecer'}
        </button>
      </form>
    </main>
  );
}
