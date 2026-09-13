'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AppRole, Team } from '@app/access-control';
import { APP_ROLES } from '@app/access-control';

/** CRUD de equipos y membresia — seccion 4.10.2 y 4.10.8. */
export function EditorDeEquipos({
  administradores,
  equipos,
  nodos,
  usuarios,
  paquetes,
}: {
  /** Quienes tienen rol Administrador en cualquier equipo (4.10.1). */
  administradores: string[];
  equipos: Team[];
  nodos: { id: string; nombre: string; tipo: string }[];
  usuarios: string[];
  paquetes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<string | null>(equipos[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (cuerpo: Record<string, unknown>) => {
    setError(null);
    const r = await fetch('/api/admin/equipos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    if (!r.ok) {
      const c = await r.json();
      setError(c.error ?? 'No se pudo guardar.');
      return;
    }
    router.refresh();
  };

  return (
    <div className="editor-equipos">
      {/*
        Quien administra, a la vista y antes de tocar nada.
        
        El servidor impide dejar la aplicacion sin ningun Administrador, pero eso solo avisa
        cuando ya se esta intentando. Con uno solo, el sistema esta a un cambio de configuracion
        —o a una baja— de necesitar el procedimiento de acceso de emergencia, y eso no se ve en
        ninguna pantalla.
      */}
      <p
        className={administradores.length < 2 ? 'aviso aviso--atencion' : 'aviso'}
        data-testid="administradores"
      >
        {administradores.length === 1
          ? `Solo ${administradores[0]} administra la aplicacion. Conviene que haya al menos dos: ` +
            `si esa cuenta se pierde, restituir el acceso exige entrar en la base de gobierno.`
          : `Administran la aplicacion: ${administradores.join(', ')}.`}
      </p>

      {error ? (
        <p className="aviso aviso--error" role="alert" data-testid="error-equipos">{error}</p>
      ) : null}

      {equipos.map((equipo) => (
        <article key={equipo.id} className="equipo" data-testid={`equipo-${equipo.id}`}>
          <button
            type="button"
            className="equipo__titulo"
            aria-expanded={abierto === equipo.id}
            onClick={() => setAbierto(abierto === equipo.id ? null : equipo.id)}
          >
            {equipo.name}
            <span className="texto-atenuado"> · {equipo.members.length} miembro(s)</span>
          </button>

          {abierto === equipo.id ? (
            <div className="equipo__detalle">
              <section>
                <h4>Nodos concedidos</h4>
                <p className="texto-atenuado">
                  Conceder una carpeta concede todo lo que contenga.
                </p>
                <ul className="lista-casillas">
                  {nodos.map((n) => {
                    const concedido = equipo.grantedNodes.includes(n.id);
                    return (
                      <li key={n.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={concedido}
                            data-testid={`conceder-${equipo.id}-${n.id}`}
                            onChange={() =>
                              void enviar({
                                accion: 'guardar',
                                equipo: {
                                  ...equipo,
                                  grantedNodes: concedido
                                    ? equipo.grantedNodes.filter((g) => g !== n.id)
                                    : [...equipo.grantedNodes, n.id],
                                },
                              })
                            }
                          />
                          {n.tipo === 'folder' ? '📁' : '📄'} {n.nombre}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section>
                <h4>Paquete visual asignado</h4>
                <p className="texto-atenuado">
                  Un paquete reagrupa lo ya accesible. Nunca concede nada nuevo.
                </p>
                <select
                  value={equipo.assignedPackageId ?? ''}
                  aria-label={`Paquete visual asignado al equipo ${equipo.name}`}
                  data-testid={`paquete-${equipo.id}`}
                  onChange={(e) => {
                    const siguiente: Team = { ...equipo };
                    if (e.target.value) siguiente.assignedPackageId = e.target.value;
                    else delete siguiente.assignedPackageId;
                    void enviar({ accion: 'guardar', equipo: siguiente });
                  }}
                >
                  <option value="">(la organizacion general tal cual)</option>
                  {paquetes.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </section>

              <section>
                <h4>Membresia</h4>
                <ul className="lista-simple">
                  {usuarios.map((u) => {
                    const miembro = equipo.members.find((m) => m.userId === u);
                    return (
                      <li key={u}>
                        <span>{u}</span>
                        {/* El nombre de al lado es texto suelto, no una etiqueta: sin
                            aria-label, un lector de pantalla anuncia una lista de selectores
                            sin decir de quien es cada uno. */}
                        <select
                          value={miembro?.role ?? ''}
                          aria-label={`Rol de ${u} en el equipo ${equipo.name}`}
                          data-testid={`rol-${equipo.id}-${u}`}
                          onChange={(e) =>
                            void enviar({
                              accion: 'membresia',
                              teamId: equipo.id,
                              userId: u,
                              role: e.target.value === '' ? null : (e.target.value as AppRole),
                            })
                          }
                        >
                          <option value="">(no es miembro)</option>
                          {APP_ROLES.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
