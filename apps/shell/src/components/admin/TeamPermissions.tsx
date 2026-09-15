'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Team } from '@app/access-control';
import { useTranslator } from '../Locale';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Que alcanza un equipo: los nodos concedidos y el paquete visual — secciones 4.10.2 y 4.1.3.
 *
 * Separado de la membresia a proposito. Son dos preguntas distintas —QUIEN esta dentro y QUE
 * alcanza— y las dos juntas en una pantalla obligaban a recorrer el arbol entero para cambiarle
 * el rol a una persona.
 */
export function TeamPermissions({
  equipo,
  nodos,
  paquetes,
}: {
  equipo: Team;
  nodos: { id: string; nombre: string; tipo: string }[];
  paquetes: { id: string; name: string }[];
}) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (siguiente: Team) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'guardar', equipo: siguiente }),
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
        <p className="aviso notice-error" role="alert" data-testid="error-permisos-equipo">
          {error}
        </p>
      ) : null}

      <section>
        <h3>{t('admin.teams.granted')}</h3>
        <p className="muted-text">{t('admin.teams.granted.intro')}</p>
        <ul className="lista-casillas">
          {nodos.map((n) => {
            const concedido = equipo.grantedNodes.includes(n.id);
            return (
              <li key={n.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={concedido}
                    disabled={enCurso}
                    data-testid={`grant-${equipo.id}-${n.id}`}
                    onChange={() =>
                      void guardar({
                        ...equipo,
                        grantedNodes: concedido
                          ? equipo.grantedNodes.filter((g) => g !== n.id)
                          : [...equipo.grantedNodes, n.id],
                      })
                    }
                  />
                  {n.nombre}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3>{t('admin.teams.package')}</h3>
        <p className="muted-text">{t('admin.teams.package.intro')}</p>
        <select
          value={equipo.assignedPackageId ?? ''}
          disabled={enCurso}
          aria-label={`${t('admin.teams.package')}: ${equipo.name}`}
          data-testid={`package-${equipo.id}`}
          onChange={(e) => {
            const siguiente: Team = { ...equipo };
            if (e.target.value) siguiente.assignedPackageId = e.target.value;
            else delete siguiente.assignedPackageId;
            void guardar(siguiente);
          }}
        >
          <option value="">{t('admin.teams.package.none')}</option>
          {paquetes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </section>
    </>
  );
}
