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
 *
 * Aqui habia tambien un desplegable de PERSONA que cambiaba de identidad sin autenticar. Era el
 * andamio con el que se desarrollo el resto y, existiendo, la aplicacion no tenia control de
 * acceso en absoluto: bastaba elegir a otra persona en un desplegable para ver sus datos. Se
 * cambia de identidad cerrando sesion y volviendo a entrar.
 */
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
   *
   * Estaba como «Equipo Distrito Norte (colaborador)» en el texto de cada `<option>`. Un
   * `<select>` no deja dar estilo a sus opciones ni ponerlas en dos lineas, asi que en el ancho
   * del panel el nombre se cortaba justo donde empezaba lo que lo distingue: «Equipo Distrito
   * Norte (cola». Fuera del desplegable el rol cabe entero y ademas se puede atenuar, que es lo
   * que merece: es contexto, no la eleccion.
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
          Su rol aqui: {rolActivo}
        </p>
      ) : null}
    </div>
  );
}
