'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type AppRole, APP_ROLES, type Team } from '@app/access-control';
import { useTranslator } from '../Locale';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Quien esta en un equipo, y con que rol — seccion 4.10.2.
 *
 * Una fila por PERSONA del directorio, con su rol en este equipo o «(no es miembro)». Se listan
 * todas y no solo los miembros porque anadir a alguien es el gesto mas frecuente, y una lista de
 * los que ya estan no tiene donde empezarlo.
 */
export function TeamMembers({
  equipo,
  personas,
}: {
  equipo: Team;
  personas: { userId: string; displayName: string }[];
}) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = async (userId: string, role: AppRole | null) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'membresia', teamId: equipo.id, userId, role }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.teams.saveFailed')));
      return;
    }
    router.refresh();
  };

  return (
    <>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="error-miembros">
          {error}
        </p>
      ) : null}

      <div className="container-table">
        <table className="tabla" data-testid="tabla-miembros">
          <thead>
            <tr>
              <th scope="col">{t('admin.users.column.person')}</th>
              <th scope="col">{t('admin.teams.column.role')}</th>
            </tr>
          </thead>
          <tbody>
            {personas.map((persona) => {
              const miembro = equipo.members.find((m) => m.userId === persona.userId);
              return (
                <tr key={persona.userId} data-testid={`miembro-${persona.userId}`}>
                  <th scope="row">
                    {persona.displayName}
                    <span className="muted-text"> {persona.userId}</span>
                  </th>
                  <td>
                    {/* El nombre de al lado es texto suelto, no una etiqueta: sin `aria-label`,
                        un lector anuncia una lista de selectores sin decir de quien es cada uno. */}
                    <select
                      value={miembro?.role ?? ''}
                      disabled={enCurso}
                      aria-label={`${t('admin.teams.column.role')}: ${persona.displayName}`}
                      data-testid={`role-${equipo.id}-${persona.userId}`}
                      onChange={(e) =>
                        void cambiar(
                          persona.userId,
                          e.target.value === '' ? null : (e.target.value as AppRole),
                        )
                      }
                    >
                      <option value="">{t('admin.teams.notMember')}</option>
                      {APP_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
