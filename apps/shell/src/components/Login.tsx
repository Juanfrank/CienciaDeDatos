'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from './Locale';

/**
 * Pantalla de acceso — seccion 4.7.
 *
 * Es la primera pantalla y la unica que ve alguien que todavia no es nadie para el sistema, asi
 * que carga con dos trabajos que ninguna otra tiene: DECIR DE QUIEN ES —emblema, nombre de la
 * institucion y del sistema— y dejar claro que no es una pagina publica. Una caja de usuario y
 * contrasena sin nada alrededor es exactamente el aspecto de una pagina de robo de credenciales.
 *
 * El camino principal es el institucional; la cuenta local va DEBAJO, como alternativa. El orden
 * no es estetico: puesto al reves, quien tiene cuenta institucional acaba escribiendo su
 * contrasena en un formulario cuando no le hacia falta.
 */
export function Login({
  azureAdAvailable,
  identity,
  destino = '/',
  variables,
}: {
  azureAdAvailable: boolean;
  identity: {
    name: string;
    shortName: string;
    emblem: { src: string; width: number; height: number };
  };
  /**
   * A donde se va al entrar. Por defecto, a la aplicacion.
   *
   * Lo necesita la vista incrustada: alli entrar tiene que dejar a la persona en la MISMA vista
   * incrustada, no llevarse la aplicacion entera a un hueco de 640 pixeles del portal anfitrion.
   */
  destino?: string;
  /**
   * El tema en variables CSS, ya resuelto en el servidor.
   *
   * Se aplican AQUI y no en la disposicion raiz porque esta pantalla se dibuja siempre en oscuro,
   * pase lo que pase con la preferencia de quien mira. Ausente en la vista incrustada, que hereda
   * el tema de alrededor.
   */
  variables?: Record<string, string>;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [mail, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [code, setCodigo] = useState('');
  const [pideCodigo, setPideCodigo] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    setError('');
    setEnviando(true);
    try {
      const r = await fetch('/api/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mail, clave, ...(code ? { code } : {}) }),
      });

      if (r.ok) {
        router.push(destino);
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
    const r = await fetch('/api/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proveedor: 'azure-ad' }),
    });
    const { error: motivo } = (await r.json()) as { error?: string };
    setError(motivo ?? 'Azure AD no esta disponible.');
  };

  return (
    <main
      className="acceso"
      {...(variables
        ? { style: { ...variables, colorScheme: 'dark' } as React.CSSProperties }
        : {})}
    >
      <div className="acceso__tarjeta">
        <header className="acceso__marca">
          {/*
            El emblema va dentro de un medallon y es DECORATIVO: el nombre esta justo debajo como
            texto, y darle tambien nombre accesible lo haria leerse dos veces.
          */}
          <span className="acceso__medallon" aria-hidden="true">
            <img
              src={identity.emblem.src}
              alt=""
              width={identity.emblem.width}
              height={identity.emblem.height}
            />
          </span>
          {/*
            El nombre del SISTEMA es el titulo de la pagina, y el de la institucion va debajo.
            Al reves, el encabezado de nivel uno seria el mismo en todas las instituciones y la
            pantalla no diria a donde se esta entrando.
          */}
          <h1 className="acceso__sistema">{t('app.name')}</h1>
          <p className="acceso__institucion" data-testid="acceso-institucion">
            {identity.name}
          </p>
        </header>

        <hr className="acceso__regla" />

        <p className="acceso__lema">
          {t('access.tagline')}
          <br />
          {t('access.instruction')}
        </p>

        <button
          type="button"
          className="acceso__microsoft"
          data-testid="login-azure"
          onClick={() => void conAzureAd()}
        >
          <LogotipoMicrosoft />
          {t('access.microsoft')}
        </button>

        {/*
          El aviso va DEBAJO, no dentro del rotulo.
          Metido en el boton, el rotulo se parte en dos lineas y lo que se lee deja de ser una
          accion para ser un parrafo con un borde alrededor.
        */}
        {azureAdAvailable ? null : (
          <p className="acceso__aviso" data-testid="azure-no-habilitado">
            {t('access.microsoftOff')}
          </p>
        )}

        <p className="acceso__separador">
          <span>{t('access.orCredentials')}</span>
        </p>

        <form
          className="acceso__formulario"
          onSubmit={(e) => {
            e.preventDefault();
            void entrar();
          }}
        >
          <p className="form__field">
            <label htmlFor="correo">{t('access.mail')}</label>
            <input
              id="correo"
              type="email"
              autoComplete="username"
              value={mail}
              data-testid="login-mail"
              onChange={(e) => setCorreo(e.target.value)}
            />
          </p>

          <p className="form__field">
            <label htmlFor="clave">{t('access.password')}</label>
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
              <label htmlFor="codigo">{t('access.code')}</label>
              <input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                data-testid="login-code"
                onChange={(e) => setCodigo(e.target.value)}
              />
            </p>
          ) : null}

          {/* El error se anuncia: quien no ve la pantalla tiene que enterarse de que fallo. */}
          <p className="acceso__error" role="alert" data-testid="login-error">
            {error}
          </p>

          <button type="submit" className="pastilla" data-testid="login-login" disabled={enviando}>
            {enviando ? t('access.checking') : t('access.submit')}
          </button>
        </form>

        <p className="acceso__nota">
          {t('access.mfaNote')}{' '}
          <a href="/reset" data-testid="link-reset">
            {t('access.reset')}
          </a>
        </p>

        {/* La forma CORTA de la institucion: el nombre entero parte el pie en dos lineas. */}
        <p className="acceso__pie">
          {t('access.rights', {
            year: String(new Date().getFullYear()),
            institution: identity.shortName,
          })}
          {' · '}
          {t('access.restricted')}
        </p>
      </div>
    </main>
  );
}

/**
 * El logotipo de Microsoft, en linea y con las medidas de su manual de marca.
 *
 * Dibujado aqui y no traido de un dominio de Microsoft porque el principio 1 no admite ninguna
 * peticion fuera del origen — y menos en la unica pantalla que ve alguien que aun no ha entrado,
 * donde una peticion a un tercero anuncia a ese tercero que esta persona esta entrando aqui.
 */
function LogotipoMicrosoft() {
  return (
    <svg
      className="acceso__logotipo"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width="8" height="8" fill="#f25022" />
      <rect x="10" y="0" width="8" height="8" fill="#7fba00" />
      <rect x="0" y="10" width="8" height="8" fill="#00a4ef" />
      <rect x="10" y="10" width="8" height="8" fill="#ffb900" />
    </svg>
  );
}
