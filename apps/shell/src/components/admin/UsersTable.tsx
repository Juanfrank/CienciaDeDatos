'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Las personas del directorio, lo que pueden y como entran — secciones 4.10.1, 4.10.2 y 4.7.2.
 *
 * Tres cambios respecto de la tabla anterior, y los tres por lo mismo: la fila decia demasiado y
 * respondia poco.
 *
 * - Los equipos eran una lista dentro de la celda. Con cuatro equipos, una fila ocupaba cuatro
 *   renglones y la tabla dejaba de leerse de un vistazo. Ahora es un NUMERO que abre el detalle.
 * - La columna «Ambito propio» decia «hereda» en casi todas las filas —es lo normal— y llevaba a
 *   una pantalla que ya esta en el carril. Una columna que casi siempre dice lo mismo no informa.
 * - Las cuentas locales vivian en una seccion aparte, con su propia tabla de las mismas personas.
 *   Quien busca «por que Beto no puede entrar» no tiene por que saber de antemano si su cuenta es
 *   local o institucional: es justo lo que viene a averiguar.
 */
export interface FilaDeUsuario {
  userId: string;
  nombre: string;
  mail: string | null;
  role: string;
  equipos: { id: string; nombre: string; role: string }[];
  /** El estado de su cuenta LOCAL, si la tiene. Quien entra por Azure AD no lleva ninguno. */
  cuenta: {
    email: string;
    bloqueada: boolean;
    intentosFallidos: number;
    tieneSegundoFactor: boolean;
  } | null;
}

interface Emitido {
  email: string;
  resetId: string;
  code?: string;
  expiraEn: string;
}

export function UsersTable({ usuarios }: { usuarios: FilaDeUsuario[] }) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emitido, setEmitido] = useState<Emitido | null>(null);

  const actuar = async (accion: 'desbloquear' | 'restablecer', email: string) => {
    setEnCurso(true);
    setError(null);
    setEmitido(null);
    const respuesta = await pedir('/api/admin/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion, email }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.accounts.failed')));
      return;
    }
    const cuerpo = (await respuesta.json()) as {
      resetId?: string;
      code?: string;
      expiraEn?: string;
    };
    if (accion === 'restablecer' && cuerpo.resetId) {
      setEmitido({
        email,
        resetId: cuerpo.resetId,
        ...(cuerpo.code ? { code: cuerpo.code } : {}),
        expiraEn: cuerpo.expiraEn ?? '',
      });
    }
    router.refresh();
  };

  return (
    <>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="accounts-error">
          {error}
        </p>
      ) : null}

      {/*
        El token emitido se queda hasta que alguien lo copie.
        Es de un solo uso y caduca; si se pierde de pantalla hay que emitir otro, y cada emision
        invalida el anterior.
      */}
      {emitido ? (
        <div className="aviso notice-atencion" data-testid="restablecimiento-emitido">
          <p>
            {t('admin.accounts.issued', {
              cuenta: emitido.email,
              cuando: new Date(emitido.expiraEn).toLocaleString('es-DO'),
            })}
          </p>
          <p>
            {t('admin.accounts.issued.id')} <code data-testid="reset-id">{emitido.resetId}</code>
          </p>
          {emitido.code ? (
            <p>
              {t('admin.accounts.issued.code')}{' '}
              <code data-testid="reset-code">{emitido.code}</code>
            </p>
          ) : null}
          <p className="muted-text">{t('admin.accounts.issued.hint')}</p>
        </div>
      ) : null}

      <div className="container-table">
        <table className="tabla" data-testid="tabla-usuarios">
          <thead>
            <tr>
              <th scope="col">{t('admin.users.column.person')}</th>
              <th scope="col">{t('admin.users.column.role')}</th>
              <th scope="col">{t('admin.users.column.teams')}</th>
              <th scope="col">{t('admin.users.column.account')}</th>
              <th scope="col">{t('admin.resources.column.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.userId} data-testid={`usuario-${u.userId}`}>
                <th scope="row">
                  {u.nombre}
                  <span className="muted-text">
                    {u.mail ? ` · ${u.mail}` : ''} · {u.userId}
                  </span>
                </th>
                <td data-testid={`usuario-${u.userId}-rol`}>{u.role}</td>
                <td>
                  <Equipos usuario={u} />
                </td>
                <td>
                  <Cuenta usuario={u} />
                </td>
                <td>
                  <span className="fila-acciones">
                    <Link
                      href={`/admin/who-sees-what?usuario=${encodeURIComponent(u.userId)}`}
                      className="button-link"
                      title={t('admin.users.whatTheySee')}
                      aria-label={`${t('admin.users.whatTheySee')}: ${u.nombre}`}
                      data-testid={`usuario-${u.userId}-que-ve`}
                    >
                      <Icon nombre="persona-ojo" tamano={18} />
                    </Link>

                    {/*
                      Desbloquear y restablecer solo existen sobre una cuenta LOCAL. Quien entra
                      por Azure AD se desbloquea y se restablece alli: ofrecerlo aqui seria un
                      boton que no puede cumplir lo que dice.
                    */}
                    {u.cuenta ? (
                      <>
                        <button
                          type="button"
                          className="button-link"
                          disabled={enCurso || !u.cuenta.bloqueada}
                          title={t('admin.accounts.unlock')}
                          aria-label={`${t('admin.accounts.unlock')}: ${u.nombre}`}
                          data-testid={`unlock-${u.userId}`}
                          onClick={() => void actuar('desbloquear', u.cuenta?.email ?? '')}
                        >
                          <Icon nombre="llave" tamano={18} />
                        </button>
                        <button
                          type="button"
                          className="button-link"
                          disabled={enCurso}
                          title={t('admin.accounts.reset')}
                          aria-label={`${t('admin.accounts.reset')}: ${u.nombre}`}
                          data-testid={`reset-${u.userId}`}
                          onClick={() => void actuar('restablecer', u.cuenta?.email ?? '')}
                        >
                          <Icon nombre="restablecer" tamano={18} />
                        </button>
                      </>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Cuantos equipos, y cuales al pulsar.
 *
 * Un DIALOGO y no un desplegable: la tabla vive dentro de un contenedor que se desplaza en
 * horizontal, y un panel absoluto dentro de una celda se recorta contra ese desbordamiento.
 */
function Equipos({ usuario }: { usuario: FilaDeUsuario }) {
  const t = useTranslator();
  const dialogo = useRef<HTMLDialogElement>(null);

  if (usuario.equipos.length === 0) {
    /*
     * Sin equipo no se ve NADA: el acceso se concede por equipo. Se dice aqui porque es la
     * explicacion de un «no veo nada» que, si no, hay que buscar en el codigo.
     */
    return (
      <span className="notice-atencion" data-testid={`usuario-${usuario.userId}-huerfano`}>
        {t('admin.users.orphan')}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="celda-numero"
        aria-label={t('admin.users.teams.count', { n: usuario.equipos.length })}
        data-testid={`usuario-${usuario.userId}-equipos`}
        onClick={() => dialogo.current?.showModal()}
      >
        {usuario.equipos.length}
      </button>

      <dialog
        className="dialogo"
        ref={dialogo}
        data-testid={`usuario-${usuario.userId}-equipos-dialogo`}
      >
        <div className="dialogo__cabecera">
          <h2>{t('admin.users.teams.title', { quien: usuario.nombre })}</h2>
          <button
            type="button"
            className="boton-contorno"
            data-testid={`cerrar-equipos-${usuario.userId}`}
            onClick={() => dialogo.current?.close()}
          >
            {t('action.close')}
          </button>
        </div>

        <div className="container-table">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">{t('admin.teams.column.team')}</th>
                <th scope="col">{t('admin.teams.column.role')}</th>
              </tr>
            </thead>
            <tbody>
              {usuario.equipos.map((e) => (
                <tr key={e.id} data-testid={`usuario-${usuario.userId}-equipo-${e.id}`}>
                  <th scope="row">
                    <Link href={`/admin/teams/${e.id}/members`}>{e.nombre}</Link>
                  </th>
                  <td>{e.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </dialog>
    </>
  );
}

/** Como entra esta persona, y si su cuenta local esta en condiciones. */
function Cuenta({ usuario }: { usuario: FilaDeUsuario }) {
  const t = useTranslator();

  if (!usuario.cuenta) {
    return (
      <span className="insignia" data-testid={`usuario-${usuario.userId}-tipo`}>
        {t('admin.accounts.kind.directory')}
      </span>
    );
  }

  return (
    <>
      <span className="insignia" data-testid={`usuario-${usuario.userId}-tipo`}>
        {t('admin.accounts.kind.local')}
      </span>{' '}
      <span
        className="pastilla-estado"
        data-status={usuario.cuenta.bloqueada ? 'bloqueada' : 'activa'}
      >
        {usuario.cuenta.bloqueada ? t('admin.accounts.locked') : t('admin.accounts.active')}
      </span>
      {usuario.cuenta.intentosFallidos > 0 ? (
        <p className="muted-text">
          {t('admin.accounts.attempts', { n: usuario.cuenta.intentosFallidos })}
        </p>
      ) : null}
      {/*
        Una cuenta local sin TOTP es un hueco, no un detalle: 4.7.2 lo trata como obligatorio
        precisamente porque estas cuentas no heredan el MFA de Azure AD.
      */}
      {usuario.cuenta.tieneSegundoFactor ? null : (
        <p className="insignia badge--error" data-testid={`without-mfa-${usuario.userId}`}>
          {t('admin.accounts.withoutMfa')}
        </p>
      )}
    </>
  );
}
