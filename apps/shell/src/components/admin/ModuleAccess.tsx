'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { AccesoAlModulo } from '../../server/admin';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';
import { pedir, motivoDeFallo } from '../pedir';

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
 * A una PERSONA se le concede a su nombre. Meterla en un equipo que ya lo tenia concedia, si,
 * pero de paso le daba todo lo demas de ese equipo, y el registro decia «cambio de membresia»
 * donde lo que habia pasado era «le dieron este modulo». La concesion individual existe ahora en
 * el modelo (`GovernedUser.grantedNodes`) y la mira todo lo que resuelve navegacion y acceso.
 *
 * Lo que NO hace es abrir el ambito: quien llega por esta via ve el modulo con las filas que le
 * tocan por su equipo activo y por las carpetas por las que cuelga, no sin restriccion.
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
        candidatos={personas.filter(
          (p) => !acceso.personas.some((q) => q.userId === p.userId && (q.directo || q.heredadoDe)),
        )}
        enCurso={enCurso}
        onAnadir={(ids) => {
          for (const userId of ids) void enviar({ accion: 'persona', userId, conceder: true });
        }}
      />

      {acceso.personas.length === 0 ? (
        <p className="muted-text" data-testid="nadie-persona">
          {t('admin.access.nobodyPerson')}
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="tabla-acceso-personas">
            <thead>
              <tr>
                <th scope="col">{t('admin.access.column.person')}</th>
                <th scope="col">{t('admin.access.column.how')}</th>
                <th scope="col">{t('admin.resources.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {acceso.personas.map((persona) => (
                <tr key={persona.userId} data-testid={`persona-${persona.userId}`}>
                  <th scope="row">
                    {persona.nombre}
                    <span className="muted-text"> {persona.userId}</span>
                  </th>
                  <td data-testid={`persona-${persona.userId}-como`}>
                    <ComoPersona persona={persona} />
                  </td>
                  <td>
                    {/*
                      Solo se quita lo concedido a su NOMBRE. Lo que le llega por un equipo se
                      revoca en el equipo, y lo heredado de una carpeta en la carpeta: una × aqui
                      que intentara cualquiera de las dos cosas dejaria a quien la pulsa creyendo
                      que lo hizo.
                    */}
                    {persona.directo ? (
                      <button
                        type="button"
                        className="button-link"
                        disabled={enCurso}
                        title={t('admin.access.revoke')}
                        aria-label={`${t('admin.access.revoke')}: ${persona.nombre}`}
                        data-testid={`quitar-persona-${persona.userId}`}
                        onClick={() =>
                          void enviar({
                            accion: 'persona',
                            userId: persona.userId,
                            conceder: false,
                          })
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
    </>
  );
}

/**
 * Por que camino alcanza una persona el modulo.
 *
 * Se dicen TODOS los que tenga, no el primero que se encuentre: quitarle la concesion individual
 * a quien ademas lo tiene por su equipo no la deja fuera, y quien pulsa la × tiene que saberlo
 * antes de pulsarla.
 */
function ComoPersona({ persona }: { persona: AccesoAlModulo['personas'][number] }) {
  const t = useTranslator();
  return (
    <>
      {persona.directo ? <span className="insignia">{t('admin.access.direct.person')}</span> : null}
      {persona.heredadoDe ? (
        <span className="insignia">
          {t('admin.access.inherited', { carpeta: persona.heredadoDe })}
        </span>
      ) : null}
      {persona.porEquipo.map((equipo) => (
        <span key={equipo} className="insignia">
          {t('admin.access.throughTeam', { equipo })}
        </span>
      ))}
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
    const respuesta = await pedir(`/api/admin/modules/${slug}/access`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.access.failed')));
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

/**
 * Dar acceso a varias personas, a su nombre.
 *
 * Sin selector de equipo ni de rol: lo que se concede es ESTE modulo, no la entrada a un equipo.
 * El rol de cada cual lo sigue decidiendo su pertenencia, que es de donde sale y donde se cambia.
 */
function AnadirPersonas({
  candidatos,
  enCurso,
  onAnadir,
}: {
  candidatos: { userId: string; nombre: string }[];
  enCurso: boolean;
  onAnadir: (ids: string[]) => void;
}) {
  const t = useTranslator();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [marcados, setMarcados] = useState<string[]>([]);

  if (candidatos.length === 0) {
    return (
      <p className="muted-text" data-testid="sin-personas-que-anadir">
        {t('admin.access.allPeople')}
      </p>
    );
  }

  return (
    <>
      <p>
        <button
          type="button"
          className="pastilla"
          data-testid="anadir-personas"
          onClick={() => {
            setMarcados([]);
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

        <ul className="simple-list">
          {candidatos.map((persona) => (
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
          disabled={enCurso || marcados.length === 0}
          data-testid="dar-acceso"
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
