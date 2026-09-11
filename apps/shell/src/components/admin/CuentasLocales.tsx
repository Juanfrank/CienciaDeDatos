'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EstadoDeCuentaLocal } from '../../server/identidad';

/**
 * Cuentas locales y sus dos vias de recuperacion — seccion 4.7.2.
 *
 * "Bloqueo de cuenta tras un numero configurable de intentos fallidos, con backoff progresivo —
 * NO BLOQUEO INDEFINIDO SIN VIA DE RECUPERACION."
 *
 * Las dos vias son distintas a proposito:
 *
 *  - **Desbloquear** pone el contador a cero sin tocar la contraseña. Es lo que necesita quien
 *    se equivoco cinco veces y ya la recuerda. Obligarle a cambiarla convertiria un error de
 *    dedos en una credencial nueva, que es peor: mas contraseñas nuevas, mas apuntadas en papel.
 *  - **Restablecer** emite un token de un solo uso con expiracion corta.
 *
 * El canal por el que viaja el token se muestra siempre. Cuando no es el correo institucional,
 * quien opera tiene que saberlo: de ese canal depende que todo el flujo sea seguro, y es el
 * Administrador —no el codigo— quien responde de haber verificado la identidad.
 */
export function CuentasLocales({
  cuentas,
  canal,
  correoDisponible,
}: {
  cuentas: EstadoDeCuentaLocal[];
  canal: string;
  correoDisponible: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [emitido, setEmitido] = useState<{
    email: string;
    resetId: string;
    codigo?: string;
    expiraEn: string;
  } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const actuar = async (accion: 'desbloquear' | 'restablecer', email: string) => {
    setError('');
    setEmitido(null);
    setTrabajando(true);
    try {
      const r = await fetch('/api/admin/cuentas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion, email }),
      });
      const cuerpo = (await r.json()) as {
        error?: string;
        resetId?: string;
        codigo?: string;
        expiraEn?: string;
      };

      if (!r.ok) {
        setError(cuerpo.error ?? 'No se pudo completar la accion.');
        return;
      }
      if (accion === 'restablecer' && cuerpo.resetId) {
        setEmitido({
          email,
          resetId: cuerpo.resetId,
          ...(cuerpo.codigo ? { codigo: cuerpo.codigo } : {}),
          expiraEn: cuerpo.expiraEn ?? '',
        });
      }
      router.refresh();
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <>
      <p className={correoDisponible ? 'aviso aviso--ok' : 'aviso aviso--atencion'} data-testid="canal-restablecimiento">
        Canal de entrega del token: <strong>{canal}</strong>.{' '}
        {correoDisponible
          ? 'El token se envia al correo verificado de la cuenta.'
          : 'Sin correo institucional configurado, el restablecimiento es MEDIADO: el codigo se ' +
            'muestra aqui y usted lo entrega a la persona por una via en la que haya verificado ' +
            'su identidad. Usted responde de esa verificacion.'}
      </p>

      <p className="acceso__error" role="alert" data-testid="cuentas-error">
        {error}
      </p>

      {emitido ? (
        <div className="aviso aviso--atencion" data-testid="restablecimiento-emitido">
          <p>
            Restablecimiento para <strong>{emitido.email}</strong>. Caduca el{' '}
            {new Date(emitido.expiraEn).toLocaleString('es-DO')} y solo se puede usar una vez.
          </p>
          <p>
            Identificador: <code data-testid="reset-id">{emitido.resetId}</code>
          </p>
          {emitido.codigo ? (
            <p>
              Codigo: <code data-testid="reset-codigo">{emitido.codigo}</code>
            </p>
          ) : null}
          <p className="texto-atenuado">
            La persona entra en /restablecer con estos dos datos y elige su contrasena nueva. Al
            hacerlo se le desbloquea la cuenta y se cierran sus sesiones abiertas.
          </p>
        </div>
      ) : null}

      <table className="tabla-datos" data-testid="tabla-cuentas">
        <caption className="texto-atenuado">
          {cuentas.length} cuenta{cuentas.length === 1 ? '' : 's'} local
          {cuentas.length === 1 ? '' : 'es'} en el sistema
        </caption>
        <thead>
          <tr>
            <th scope="col">Cuenta</th>
            <th scope="col">Estado</th>
            <th scope="col">Segundo factor</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((c) => (
            <tr key={c.userId} data-testid={`cuenta-${c.userId}`}>
              <th scope="row">
                {c.userId}
                <span className="texto-atenuado"> · {c.email}</span>
              </th>
              <td>
                <span className="pastilla-estado" data-estado={c.bloqueada ? 'bloqueada' : 'activa'}>
                  {c.bloqueada ? 'Bloqueada' : 'Activa'}
                </span>
                {c.intentosFallidos > 0 ? (
                  <span className="texto-atenuado"> · {c.intentosFallidos} intentos fallidos</span>
                ) : null}
              </td>
              <td>
                {/*
                  Una cuenta local sin TOTP es un hueco, no un detalle: 4.7.2 lo trata como
                  obligatorio precisamente porque estas cuentas no heredan el MFA de Azure AD.
                */}
                {c.tieneSegundoFactor ? (
                  'TOTP configurado'
                ) : (
                  <strong data-testid={`sin-mfa-${c.userId}`}>Sin segundo factor</strong>
                )}
              </td>
              <td className="editor__acciones">
                <button
                  type="button"
                  className="boton-enlace"
                  data-testid={`desbloquear-${c.userId}`}
                  disabled={trabajando || !c.bloqueada}
                  onClick={() => void actuar('desbloquear', c.email)}
                >
                  Desbloquear
                </button>
                <button
                  type="button"
                  className="boton-enlace"
                  data-testid={`restablecer-${c.userId}`}
                  disabled={trabajando}
                  onClick={() => void actuar('restablecer', c.email)}
                >
                  Restablecer contrasena
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
