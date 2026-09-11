'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Selector de espacio de trabajo — seccion 4.10.2.
 *
 * "La aplicacion debe operar con un EQUIPO ACTIVO POR SESION, visible en todo momento en la
 * interfaz, no con una union implicita de todos los equipos del usuario."
 *
 * Cambiarlo es una escritura del lado servidor sobre la sesion: el ambito de datos efectivo
 * cambia de inmediato SIN cerrar sesion (criterio de la seccion 9). Por eso llama a la API y
 * refresca, en vez de guardar nada en el cliente.
 */
export function SelectorDeEquipo({
  equipos,
  equipoActivo,
  usuarios,
  usuarioActivo,
}: {
  equipos: { id: string; name: string; role: string }[];
  equipoActivo: string;
  usuarios: { id: string; name: string }[];
  usuarioActivo: string;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  const cambiar = async (cuerpo: Record<string, string>) => {
    await fetch('/api/sesion/equipo-activo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    iniciarTransicion(() => router.refresh());
  };

  return (
    <div className="selector-equipo" data-pendiente={pendiente}>
      <label className="selector-equipo__campo">
        <span className="selector-equipo__etiqueta">Persona</span>
        <select
          value={usuarioActivo}
          data-testid="selector-usuario"
          onChange={(e) => void cambiar({ userId: e.target.value })}
        >
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>

      <label className="selector-equipo__campo">
        <span className="selector-equipo__etiqueta">Equipo activo</span>
        <select
          value={equipoActivo}
          data-testid="selector-equipo"
          onChange={(e) => void cambiar({ teamId: e.target.value })}
        >
          {equipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.role})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
