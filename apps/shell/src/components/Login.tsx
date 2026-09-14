'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Pantalla de inicio de sesion — seccion 4.7. */
export function Login({
  azureAdDisponible,
  identity,
}: {
  azureAdDisponible: boolean;
  identity: { name: string; emblem: { src: string; width: number; height: number } };
}) {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [code, setCodigo] = useState('');
  const [pideCodigo, setPideCodigo] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    setError('');
    setEnviando(true);
    try {
      const r = await fetch('/api/acceso', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ correo, clave, ...(code ? { code } : {}) }),
      });

      if (r.ok) {
        router.push('/');
        router.refresh();
        return;
      }

      const { error: motivo } = (await r.json()) as { error?: string };
      // 428 es "falta el segundo factor": no es un fallo de credenciales, es un paso mas.
      if (r.status === 428) setPideCodigo(true);
      setError(motivo ?? 'No se pudo iniciar sesion.');
    } finally {
      setEnviando(false);
    }
  };

  const conAzureAd = async () => {
    setError('');
    const r = await fetch('/api/acceso', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proveedor: 'azure-ad' }),
    });
    const { error: motivo } = (await r.json()) as { error?: string };
    setError(motivo ?? 'Azure AD no esta disponible.');
  };

  return (
    <main className="acceso">
      <div className="login__mark">
        {/* Decorativo: el nombre va como texto justo debajo, y duplicarlo lo anunciaria dos veces. */}
        <img src={identity.emblem.src} alt="" width={identity.emblem.width} height={identity.emblem.height} />
        <p className="login__institucion md-title-medium" data-testid="acceso-institucion">
          {identity.name}
        </p>
      </div>

      <form
        className="login__card"
        onSubmit={(e) => {
          e.preventDefault();
          void entrar();
        }}
      >
        <h1>Iniciar sesion</h1>

        <button
          type="button"
          className="login__azure"
          data-testid="acceso-azure"
          onClick={() => void conAzureAd()}
        >
          Continuar con Azure AD
          {azureAdDisponible ? '' : ' (no configurado en este entorno)'}
        </button>

        <p className="login__separador">
          <span>o con credenciales locales</span>
        </p>

        <p className="form__field">
          <label htmlFor="correo">Correo institucional</label>
          <input
            id="correo"
            type="email"
            autoComplete="username"
            value={correo}
            data-testid="acceso-correo"
            onChange={(e) => setCorreo(e.target.value)}
          />
        </p>

        <p className="form__field">
          <label htmlFor="clave">Contrasena</label>
          <input
            id="clave"
            type="password"
            autoComplete="current-password"
            value={clave}
            data-testid="key-login"
            onChange={(e) => setClave(e.target.value)}
          />
        </p>

        {pideCodigo ? (
          <p className="form__field">
            <label htmlFor="codigo">Codigo de verificacion</label>
            <input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              data-testid="acceso-codigo"
              onChange={(e) => setCodigo(e.target.value)}
            />
          </p>
        ) : null}

        {/* El error se anuncia: quien no ve la pantalla tiene que enterarse de que fallo. */}
        <p className="login__error" role="alert" data-testid="acceso-error">
          {error}
        </p>

        <button type="submit" className="pastilla" data-testid="acceso-entrar" disabled={enviando}>
          {enviando ? 'Comprobando…' : 'Entrar'}
        </button>

        <p className="muted-text">
          Las cuentas locales exigen un second factor. Si olvido su contrasena, un Administrador
          inicia el restablecimiento y le entrega un code de un solo uso; con el, entre en{' '}
          <a href="/restablecer" data-testid="enlace-restablecer">
            restablecer contrasena
          </a>
          .
        </p>
      </form>
    </main>
  );
}
