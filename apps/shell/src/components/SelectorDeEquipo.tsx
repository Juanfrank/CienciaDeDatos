'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/** Selector de espacio de trabajo — seccion 4.10.2. */
export function SelectorDeEquipo({
  equipos,
  equipoActivo,
}: {
  equipos: { id: string; name: string; role: string }[];
  equipoActivo: string;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  const cambiar = async (teamId: string) => {
    await fetch('/api/sesion/equipo-activo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    iniciarTransicion(() => router.refresh());
  };

  /*
   * El rol va DEBAJO, no dentro de la opcion.
   */
  const rolActivo = equipos.find((t) => t.id === equipoActivo)?.role;

  return (
    <div className="selector-equipo" data-pendiente={pendiente}>
      <label className="selector-equipo__campo">
        <span className="selector-equipo__etiqueta">Equipo activo</span>
        <select
          value={equipoActivo}
          data-testid="selector-equipo"
          onChange={(e) => void cambiar(e.target.value)}
        >
          {equipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {rolActivo ? (
        <p className="selector-equipo__rol" data-testid="rol-en-equipo">
          Su role aqui: {rolActivo}
        </p>
      ) : null}
    </div>
  );
}
