'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { pedir } from './pedir';

/** Selector de espacio de trabajo — seccion 4.10.2. */
export function TeamPicker({
  equipos,
  equipoActivo,
}: {
  equipos: { id: string; name: string; role: string }[];
  equipoActivo: string;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  const cambiar = async (teamId: string) => {
    await pedir('/api/session/active-team', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    iniciarTransicion(() => router.refresh());
  };

  /*
   * El rol va DEBAJO, no dentro de la opcion.
   */
  const activeRole = equipos.find((t) => t.id === equipoActivo)?.role;

  return (
    <div className="team-picker" data-pendiente={pendiente}>
      <label className="team-picker__field">
        <span className="team-picker__label">Equipo activo</span>
        <select
          value={equipoActivo}
          data-testid="team-picker"
          onChange={(e) => void cambiar(e.target.value)}
        >
          {equipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {activeRole ? (
        <p className="team-picker__role" data-testid="team-role">
          Su rol aqui: {activeRole}
        </p>
      ) : null}
    </div>
  );
}
