'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { MessageKey } from '@app/i18n';
import type { AccesoAlModulo } from '../../server/admin';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';

/**
 * Quien ve este modulo, por equipo y por persona — secciones 4.10.6 y 4.10.8.
 *
 * Es lo mismo que ya se concede desde el equipo, leido desde el otro extremo: «que ve este
 * equipo» se pregunta al dar de alta a alguien, y «quien ve esto» al publicar un tablero con
 * datos sensibles. Sin esta pantalla, la segunda obliga a abrir los equipos uno por uno.
 *
 * Las tablas ensenan solo QUIEN TIENE acceso, y la unica accion de una fila es quitarlo. Antes
 * listaban tambien a los que no lo tenian, con un boton de conceder por fila: la tabla contestaba
 * «quien no lo ve», que no es la pregunta, y crecia con cada equipo nuevo de la institucion.
 * Conceder es otra cosa y tiene su propio boton, con una lista donde se marcan varios de una vez.
 *
 * A una PERSONA no se le concede directamente. No es una limitacion de la pantalla: el modelo
 * resuelve el acceso por equipo (4.10.6), y una concesion individual seria un segundo camino que
 * la resolucion de ambito no consulta — la pantalla diria que alguien ve algo que no ve. Lo que
 * si se hace desde aqui es meter a esa persona en un equipo que ya lo tiene.
 */
export function ModuleAccess({
  slug,
  acceso,
  personas,
}: {
  slug: string;
  acceso: AccesoAlModulo;
  /** Todo el directorio, para poder anadir a alguien que aun no esta en ningun equipo. */
  personas: { userId: string; nombre: string }[];
}) {
  const t = useTranslator();
  const { enviar, enCurso, error } = useAcceso(slug);

  if (acceso.nodeId === null) {
    return (
      <p className="aviso notice-atencion" data-testid="sin-nodo">
        {t('admin.access.notInTree')}
      </p>
    );
  }

  const conAcceso = acceso.equipos.filter((e) => e.alcanza);
  const sinAcceso = acceso.equipos.filter((e) => !e.alcanza);

  return (
    <>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="access-error">
          {error}
        </p>
      ) : null}

      <h3>{t('admin.access.teams')}</h3>

      <AnadirEquipos
        candidatos={sinAcceso.map((e) => ({ id: e.teamId, nombre: e.nombre }))}
        enCurso={enCurso}
        onAnadir={(ids) => {
          for (const teamId of ids) void enviar({ accion: 'equipo', teamId, conceder: true });
        }}
      />

      {conAcceso.length === 0 ? (
        <p className="muted-text" data-testid="nadie-lo-ve">
          {t('admin.access.nobody')}
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="tabla-acceso-equipos">
            <thead>
              <tr>
                <th scope="col">{t('admin.access.column.team')}</th>
                <th scope="col">{t('admin.access.column.how')}</th>
                <th scope="col">{t('admin.access.column.people')}</th>
                <th scope="col">{t('admin.resources.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {conAcceso.map((equipo) => (
                <tr key={equipo.teamId} data-testid={`acceso-${equipo.teamId}`}>
                  <th scope="row">
                    <Link href="/admin/teams">{equipo.nombre}</Link>
                  </th>
                  <td data-testid={`acceso-${equipo.teamId}-como`}>
                    <Como equipo={equipo} />
                  </td>
                  <td>{equipo.miembros.length}</td>
                  <td>
                    {/*
                      Lo heredado no se quita desde aqui: habria que quitarle al equipo la carpeta
                      entera, que es otra decision y afecta a mas modulos. Se dice, en vez de
                      ofrecer un boton que no haria lo que promete.
                    */}
                    {equipo.directo ? (
                      <button
                        type="button"
                        className="button-link"
                        disabled={enCurso}
                        title={t('admin.access.revoke')}
                        aria-label={`${t('admin.access.revoke')}: ${equipo.nombre}`}
                        data-testid={`quitar-equipo-${equipo.teamId}`}
                        onClick={() =>
                          void enviar({ accion: 'equipo', teamId: equipo.teamId, conceder: false })
                        }
                      >
                        <Icon nombre="close" tamano={18} />
                      </button>
                    ) : (
                      <span className="muted-text">{t('admin.access.inherited.revokeThere')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{t('admin.access.people')}</h3>
      <p className="muted-text">{t('admin.access.people.intro')}</p>

      <AnadirPersonas
        equipos={conAcceso.map((e) => ({ id: e.teamId, nombre: e.nombre }))}
        personas={personas.filter(
          (p) => !conAcceso.some((e) => e.miembros.some((m) => m.userId === p.userId)),
        )}
        enCurso={enCurso}
        onAnadir={(ids, teamId, role) => {
          for (const userId of ids) {
            void enviar({ accion: 'persona', teamId, userId, role, conceder: true });
          }
        }}
      />

      {conAcceso.length === 0 ? null : (
        <div className="container-table">
          <table className="tabla" data-testid="tabla-acceso-personas">
            <thead>
              <tr>
                <th scope="col">{t('admin.access.column.person')}</th>
                <th scope="col">{t('admin.access.column.through')}</th>
                <th scope="col">{t('admin.access.column.role')}</th>
                <th scope="col">{t('admin.resources.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {conAcceso.flatMap((equipo) =>
                equipo.miembros.map((persona) => (
                  <tr
                    key={`${equipo.teamId}-${persona.userId}`}
                    data-testid={`persona-${persona.userId}-${equipo.teamId}`}
                  >
                    <th scope="row">
                      {persona.nombre}
                      <span className="muted-text"> {persona.userId}</span>
                    </th>
                    <td>{equipo.nombre}</td>
                    <td>{t(`role.${persona.role}` as MessageKey)}</td>
                    <td>
                      <button
                        type="button"
                        className="button-link"
                        disabled={enCurso}
                        title={t('admin.access.removeFromTeam')}
                        aria-label={`${t('admin.access.removeFromTeam')}: ${persona.nombre}`}
                        data-testid={`quitar-${persona.userId}-${equipo.teamId}`}
                        onClick={() =>
                          void enviar({
                            accion: 'persona',
                            teamId: equipo.teamId,
                            userId: persona.userId,
                            conceder: false,
                          })
                        }
                      >
                        <Icon nombre="close" tamano={18} />
                      </button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Lo que las dos secciones comparten: una llamada, si esta en curso, y el ultimo error. */
function useAcceso(slug: string) {
  const t = useTranslator();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (cuerpo: Record<string, unknown>) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await fetch(`/api/admin/modules/${slug}/access`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const body = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? t('admin.access.failed'));
      return;
    }
    // `router.refresh()` no vale aqui: se llama una vez por elemento marcado y el refresco de
    // cada uno cancelaria al siguiente. Se recarga cuando terminan todos.
    window.location.reload();
  };

  return { enviar, enCurso, error };
}

/**
 * Como llega el acceso: concedido aqui o heredado de una carpeta.
 *
 * Aparte y con nombre, no como ternario anidado dentro de la fila: la rama del medio colapsa en
 * una linea que el trinquete de cadenas sueltas cuenta como prosa de pantalla.
 */
function Como({ equipo }: { equipo: AccesoAlModulo['equipos'][number] }) {
  const t = useTranslator();
  if (equipo.directo) return <span className="insignia">{t('admin.access.direct')}</span>;
  if (equipo.heredadoDe) {
    return (
      <span className="insignia">
        {t('admin.access.inherited', { carpeta: equipo.heredadoDe })}
      </span>
    );
  }
  return <span className="muted-text">{t('admin.access.none')}</span>;
}

/** Anadir varios equipos de una vez: se marcan en una lista y se conceden juntos. */
function AnadirEquipos({
  candidatos,
  enCurso,
  onAnadir,
}: {
  candidatos: { id: string; nombre: string }[];
  enCurso: boolean;
  onAnadir: (ids: string[]) => void;
}) {
  const t = useTranslator();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [marcados, setMarcados] = useState<string[]>([]);

  if (candidatos.length === 0) {
    return (
      <p className="muted-text" data-testid="sin-equipos-que-anadir">
        {t('admin.access.allTeams')}
      </p>
    );
  }

  return (
    <>
      <p>
        <button
          type="button"
          className="pastilla"
          data-testid="anadir-equipos"
          onClick={() => {
            setMarcados([]);
            dialogo.current?.showModal();
          }}
        >
          {t('admin.access.addTeams')}
        </button>
      </p>

      <dialog className="dialogo" ref={dialogo} data-testid="dialogo-equipos">
        <div className="dialogo__cabecera">
          <h2>{t('admin.access.addTeams')}</h2>
          <button
            type="button"
            className="boton-contorno"
            data-testid="cerrar-equipos"
            onClick={() => dialogo.current?.close()}
          >
            {t('action.cancel')}
          </button>
        </div>

        <ul className="simple-list">
          {candidatos.map((equipo) => (
            <li key={equipo.id}>
              <label>
                <input
                  type="checkbox"
                  checked={marcados.includes(equipo.id)}
                  data-testid={`marcar-equipo-${equipo.id}`}
                  onChange={() =>
                    setMarcados((previos) =>
                      previos.includes(equipo.id)
                        ? previos.filter((id) => id !== equipo.id)
                        : [...previos, equipo.id],
                    )
                  }
                />{' '}
                {equipo.nombre}
              </label>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="pastilla"
          disabled={enCurso || marcados.length === 0}
          data-testid="conceder-marcados"
          onClick={() => {
            dialogo.current?.close();
            onAnadir(marcados);
          }}
        >
          {t('admin.access.grantN', { n: marcados.length })}
        </button>
      </dialog>
    </>
  );
}

/** Dar acceso a varias personas: se marcan, y entran todas en el mismo equipo con el mismo rol. */
function AnadirPersonas({
  equipos,
  personas,
  enCurso,
  onAnadir,
}: {
  equipos: { id: string; nombre: string }[];
  personas: { userId: string; nombre: string }[];
  enCurso: boolean;
  onAnadir: (ids: string[], teamId: string, role: string) => void;
}) {
  const t = useTranslator();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [teamId, setTeamId] = useState(equipos[0]?.id ?? '');
  const [role, setRole] = useState('visor');

  // Sin equipo con acceso no hay donde meter a nadie: el boton llevaria a un dialogo sin destino.
  if (equipos.length === 0 || personas.length === 0) return null;

  return (
    <>
      <p>
        <button
          type="button"
          className="pastilla"
          data-testid="anadir-personas"
          onClick={() => {
            setMarcados([]);
            setTeamId(equipos[0]?.id ?? '');
            dialogo.current?.showModal();
          }}
        >
          {t('admin.access.addPeople')}
        </button>
      </p>

      <dialog className="dialogo" ref={dialogo} data-testid="dialogo-personas">
        <div className="dialogo__cabecera">
          <h2>{t('admin.access.addPeople')}</h2>
          <button
            type="button"
            className="boton-contorno"
            data-testid="cerrar-personas"
            onClick={() => dialogo.current?.close()}
          >
            {t('action.cancel')}
          </button>
        </div>

        <p className="muted-text">{t('admin.access.addPeople.intro')}</p>

        <label className="form__field">
          <span>{t('admin.access.column.through')}</span>
          <select value={teamId} data-testid="equipo-destino" onChange={(e) => setTeamId(e.target.value)}>
            {equipos.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="form__field">
          <span>{t('admin.access.column.role')}</span>
          {/* Los tres roles de 4.10.1, con el nombre del catalogo: son los mismos de la tabla de
              permisos, y escribirlos aqui a mano los dejaria sin traducir. */}
          <select value={role} data-testid="rol-nuevo" onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((cual) => (
              <option key={cual} value={cual}>
                {t(`role.${cual}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>

        <ul className="simple-list">
          {personas.map((persona) => (
            <li key={persona.userId}>
              <label>
                <input
                  type="checkbox"
                  checked={marcados.includes(persona.userId)}
                  data-testid={`marcar-persona-${persona.userId}`}
                  onChange={() =>
                    setMarcados((previos) =>
                      previos.includes(persona.userId)
                        ? previos.filter((id) => id !== persona.userId)
                        : [...previos, persona.userId],
                    )
                  }
                />{' '}
                {persona.nombre} <span className="muted-text">{persona.userId}</span>
              </label>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="pastilla"
          disabled={enCurso || marcados.length === 0 || teamId === ''}
          data-testid="dar-acceso"
          onClick={() => {
            dialogo.current?.close();
            onAnadir(marcados, teamId, role);
          }}
        >
          {t('admin.access.grantN', { n: marcados.length })}
        </button>
      </dialog>
    </>
  );
}

/** Los tres roles de 4.10.1. No son configurables, asi que la lista es fija a proposito. */
const ROLES = ['visor', 'colaborador', 'administrador'] as const;
