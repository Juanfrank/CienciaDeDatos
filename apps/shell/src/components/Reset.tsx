'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Restablecimiento de contraseña — seccion 4.7.2. */
export function Reset() {
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
      setError('Las dos contraseñas no coinciden.');
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
      setError(`${body.error ?? 'No se pudo restablecer la contraseña.'}${detalle}`);
    } finally {
      setEnviando(false);
    }
  };

  if (hecho) {
    return (
      <main className="pantalla">
        <div className="pantalla__tarjeta">
          <h1>Contraseña restablecida</h1>
          <p className="muted-text">
            Ya puede iniciar sesión con la contraseña nueva y su código de verificación. Las
            sesiones que estuvieran abiertas con la anterior se han cerrado.
          </p>
          <button
            type="button"
            className="pastilla"
            data-testid="reset-ir-a-acceso"
            onClick={() => router.push('/sign-in')}
          >
            Iniciar sesión
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
        <h1>Restablecer contraseña</h1>
        <p className="muted-text">
          Con el identificador y el código que le entregó un Administrador. El código solo sirve
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
          <label htmlFor="reset-code">Código</label>
          <input
            id="reset-code"
            value={code}
            data-testid="reset-code"
            onChange={(e) => setCodigo(e.target.value)}
          />
        </p>

        <p className="form__field">
          <label htmlFor="reset-clave">Contraseña nueva</label>
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
            Al menos 12 caracteres, con mayúscula, minúscula, dígito y símbolo. No puede ser
            ninguna de sus últimas cinco contraseñas.
          </span>
        </p>

        <p className="form__field">
          <label htmlFor="reset-repetida">Repita la contraseña nueva</label>
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
          {enviando ? 'Comprobando…' : 'Restablecer'}
        </button>
      </form>
    </main>
  );
}
