'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Pantalla de inicio de sesion — seccion 4.7. */
export function Acceso({
  azureAdDisponible,
  identidad,
}: {
  azureAdDisponible: boolean;
  identidad: { name: string; emblem: { src: string; width: number; height: number } };
}) {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [codigo, setCodigo] = useState('');
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
        body: JSON.stringify({ correo, clave, ...(codigo ? { codigo } : {}) }),
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
      <div className="acceso__marca">
        {/* Decorativo: el nombre va como texto justo debajo, y duplicarlo lo anunciaria dos veces. */}
        <img src={identidad.emblem.src} alt="" width={identidad.emblem.width} height={identidad.emblem.height} />
        <p className="acceso__institucion md-title-medium" data-testid="acceso-institucion">
          {identidad.name}
        </p>
      </div>

      <form
        className="acceso__tarjeta"
        onSubmit={(e) => {
          e.preventDefault();
          void entrar();
        }}
      >
        <h1>Iniciar sesion</h1>

        <button
          type="button"
          className="acceso__azure"
          data-testid="acceso-azure"
          onClick={() => void conAzureAd()}
        >
          Continuar con Azure AD
          {azureAdDisponible ? '' : ' (no configurado en este entorno)'}
        </button>

        <p className="acceso__separador">
          <span>o con credenciales locales</span>
        </p>

        <p className="formulario__campo">
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

        <p className="formulario__campo">
          <label htmlFor="clave">Contrasena</label>
          <input
            id="clave"
            type="password"
            autoComplete="current-password"
            value={clave}
            data-testid="acceso-clave"
            onChange={(e) => setClave(e.target.value)}
          />
        </p>

        {pideCodigo ? (
          <p className="formulario__campo">
            <label htmlFor="codigo">Codigo de verificacion</label>
            <input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigo}
              data-testid="acceso-codigo"
              onChange={(e) => setCodigo(e.target.value)}
            />
          </p>
        ) : null}

        {/* El error se anuncia: quien no ve la pantalla tiene que enterarse de que fallo. */}
        <p className="acceso__error" role="alert" data-testid="acceso-error">
          {error}
        </p>

        <button type="submit" className="pastilla" data-testid="acceso-entrar" disabled={enviando}>
          {enviando ? 'Comprobando…' : 'Entrar'}
        </button>

        <p className="texto-atenuado">
          Las cuentas locales exigen un second factor. Si olvido su contrasena, un Administrador
          inicia el restablecimiento y le entrega un codigo de un solo uso; con el, entre en{' '}
          <a href="/restablecer" data-testid="enlace-restablecer">
            restablecer contrasena
          </a>
          .
        </p>
      </form>
    </main>
  );
}
