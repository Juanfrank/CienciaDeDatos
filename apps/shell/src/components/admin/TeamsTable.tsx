'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Los equipos, en tabla — secciones 4.10.2 y 4.10.8.
 *
 * Eran un acordeon donde cada equipo abria, de golpe, la lista entera de nodos del arbol, el
 * desplegable de paquete y un selector de rol por cada persona del directorio. Con cuatro
 * equipos y veinte personas eso es una pantalla que hay que recorrer para responder «cuantos
 * miembros tiene Estadisticas», que es la pregunta que se hace al entrar.
 *
 * La tabla responde esa pregunta sin abrir nada, y lo demas vive en su propia pantalla: quien
 * viene a cambiar la membresia de un equipo no tiene delante los nodos concedidos de los otros
 * tres.
 */
export interface FilaDeEquipo {
  id: string;
  nombre: string;
  miembros: number;
}

export function TeamsTable({ equipos }: { equipos: FilaDeEquipo[] }) {
  const t = useTranslator();
  const router = useRouter();
  const [borrando, setBorrando] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const borrar = async (id: string) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'borrar', teamId: id }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.teams.deleteFailed')));
      return;
    }
    setBorrando(null);
    router.refresh();
  };

  if (equipos.length === 0) {
    return <p className="muted-text" data-testid="sin-equipos">{t('admin.teams.empty')}</p>;
  }

  return (
    <>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="error-teams">
          {error}
        </p>
      ) : null}

      <div className="container-table">
        <table className="tabla" data-testid="tabla-equipos">
          <thead>
            <tr>
              <th scope="col">{t('admin.teams.column.team')}</th>
              <th scope="col">{t('admin.teams.column.members')}</th>
              <th scope="col">{t('admin.resources.column.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((equipo) => (
              <tr key={equipo.id} data-testid={`equipo-${equipo.id}`}>
                <th scope="row">{equipo.nombre}</th>
                {/* El numero, no la lista. Quien quiera los nombres entra en «miembros». */}
                <td data-testid={`equipo-${equipo.id}-miembros`}>{equipo.miembros}</td>
                <td>
                  <span className="fila-acciones">
                    <Link
                      href={`/admin/teams/${equipo.id}/members`}
                      className="button-link"
                      title={t('admin.teams.action.members')}
                      aria-label={`${t('admin.teams.action.members')}: ${equipo.nombre}`}
                      data-testid={`miembros-${equipo.id}`}
                    >
                      <Icon nombre="persona-tuerca" tamano={18} />
                    </Link>
                    <Link
                      href={`/admin/teams/${equipo.id}/permissions`}
                      className="button-link"
                      title={t('admin.teams.action.permissions')}
                      aria-label={`${t('admin.teams.action.permissions')}: ${equipo.nombre}`}
                      data-testid={`permisos-equipo-${equipo.id}`}
                    >
                      <Icon nombre="tuerca" tamano={18} />
                    </Link>
                    <button
                      type="button"
                      className="button-link"
                      disabled={enCurso}
                      title={t('admin.teams.action.delete')}
                      aria-label={`${t('admin.teams.action.delete')}: ${equipo.nombre}`}
                      aria-expanded={borrando === equipo.id}
                      data-testid={`borrar-equipo-${equipo.id}`}
                      onClick={() => setBorrando(borrando === equipo.id ? null : equipo.id)}
                    >
                      <Icon nombre="close" tamano={18} />
                    </button>
                  </span>

                  {/*
                    Borrar un equipo quita el acceso de todos sus miembros a la vez, y eso no se
                    deshace pulsando otra vez: se pregunta antes, en la propia fila.
                  */}
                  {borrando === equipo.id ? (
                    <div
                      className="aviso notice-atencion"
                      role="alert"
                      data-testid={`borrar-equipo-aviso-${equipo.id}`}
                    >
                      <p>{t('admin.teams.delete.confirm', { n: equipo.miembros })}</p>
                      <button
                        type="button"
                        className="pastilla"
                        disabled={enCurso}
                        data-testid={`borrar-equipo-confirmar-${equipo.id}`}
                        onClick={() => void borrar(equipo.id)}
                      >
                        {t('admin.teams.action.delete')}
                      </button>{' '}
                      <button
                        type="button"
                        className="boton-contorno"
                        disabled={enCurso}
                        data-testid={`borrar-equipo-cancelar-${equipo.id}`}
                        onClick={() => setBorrando(null)}
                      >
                        {t('action.cancel')}
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
