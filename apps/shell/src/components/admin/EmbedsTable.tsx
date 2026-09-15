'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Donde estan las vistas de la institucion incrustadas fuera — seccion 4.9.
 *
 * Es el registro que antes no existia: el codigo de incrustacion era una URL que cualquiera
 * componia a mano, asi que no habia lista, no habia dueno y no habia forma de retirar una vista
 * de la pagina de otro sin cambiar el modulo entero.
 */
export interface FilaDeCodigo {
  code: string;
  modulo: string;
  pagina: string | null;
  cromo: string;
  filtros: number;
  creadoPor: string;
  creadoEn: string;
  revocadoPor: string | null;
  revocadoEn: string | null;
  motivo: string | null;
}

export function EmbedsTable({ codigos }: { codigos: FilaDeCodigo[] }) {
  const t = useTranslator();
  const router = useRouter();
  const [revocando, setRevocando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revocar = async (code: string) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/embeds', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codigo: code, motivo }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.embeds.revokeFailed')));
      return;
    }
    setRevocando(null);
    setMotivo('');
    router.refresh();
  };

  if (codigos.length === 0) {
    return (
      <p className="muted-text" data-testid="sin-codigos">
        {t('admin.embeds.empty')}
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="error-embeds">
          {error}
        </p>
      ) : null}

      <div className="container-table">
        <table className="tabla" data-testid="tabla-codigos">
          <thead>
            <tr>
              <th scope="col">{t('admin.embeds.column.code')}</th>
              <th scope="col">{t('admin.embeds.column.module')}</th>
              <th scope="col">{t('admin.embeds.column.by')}</th>
              <th scope="col">{t('admin.embeds.column.state')}</th>
              <th scope="col">{t('admin.resources.column.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {codigos.map((c) => (
              <tr key={c.code} data-testid={`codigo-${c.code}`}>
                <th scope="row">
                  <code>{c.code}</code>
                  <p className="muted-text">
                    {t(`admin.embeds.chrome.${c.cromo === 'limpio' ? 'clean' : 'full'}`)}
                    {c.filtros > 0 ? ` · ${t('admin.embeds.filters', { n: c.filtros })}` : ''}
                  </p>
                </th>
                <td>
                  {c.modulo}
                  {c.pagina ? <span className="muted-text"> / {c.pagina}</span> : null}
                </td>
                <td>
                  {c.creadoPor}
                  <p className="muted-text">
                    <time dateTime={c.creadoEn}>
                      {new Date(c.creadoEn).toLocaleString('es-DO')}
                    </time>
                  </p>
                </td>
                <td>
                  {c.revocadoEn ? (
                    <>
                      <span className="insignia badge--error" data-testid={`estado-${c.code}`}>
                        {t('admin.embeds.revoked')}
                      </span>
                      <p className="muted-text">
                        {t('admin.embeds.revoked.by', {
                          quien: c.revocadoPor ?? '',
                          cuando: new Date(c.revocadoEn).toLocaleString('es-DO'),
                        })}
                      </p>
                      {c.motivo ? <p className="muted-text">{c.motivo}</p> : null}
                    </>
                  ) : (
                    <span className="insignia" data-testid={`estado-${c.code}`}>
                      {t('admin.embeds.active')}
                    </span>
                  )}
                </td>
                <td>
                  {c.revocadoEn ? (
                    <span className="muted-text">—</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button-link"
                        disabled={enCurso}
                        title={t('admin.embeds.revoke')}
                        aria-label={`${t('admin.embeds.revoke')}: ${c.code}`}
                        aria-expanded={revocando === c.code}
                        data-testid={`revocar-${c.code}`}
                        onClick={() => setRevocando(revocando === c.code ? null : c.code)}
                      >
                        <Icon nombre="ojo-tachado" tamano={18} />
                      </button>

                      {/*
                        El motivo NO es obligatorio, pero se ofrece: es lo que la pagina revocada
                        ensena a quien la encuentra en el portal anfitrion. Sin el, el aviso dice
                        que el vinculo se suprimio y nada mas, que ya es mejor que un 404.
                      */}
                      {revocando === c.code ? (
                        <div
                          className="aviso notice-atencion"
                          role="alert"
                          data-testid={`revocar-aviso-${c.code}`}
                        >
                          <p>{t('admin.embeds.revoke.confirm')}</p>
                          <label className="form__field" htmlFor={`motivo-${c.code}`}>
                            {t('admin.embeds.revoke.reason')}
                          </label>
                          <input
                            id={`motivo-${c.code}`}
                            type="text"
                            value={motivo}
                            disabled={enCurso}
                            data-testid={`revocar-motivo-${c.code}`}
                            onChange={(e) => setMotivo(e.target.value)}
                          />
                          <button
                            type="button"
                            className="pastilla"
                            disabled={enCurso}
                            data-testid={`revocar-confirmar-${c.code}`}
                            onClick={() => void revocar(c.code)}
                          >
                            {t('admin.embeds.revoke')}
                          </button>{' '}
                          <button
                            type="button"
                            className="boton-contorno"
                            disabled={enCurso}
                            data-testid={`revocar-cancelar-${c.code}`}
                            onClick={() => setRevocando(null)}
                          >
                            {t('action.cancel')}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
