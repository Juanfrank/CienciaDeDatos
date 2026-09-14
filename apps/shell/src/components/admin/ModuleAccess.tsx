'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
 * A una PERSONA no se le concede directamente. No es una limitacion de la pantalla: el modelo
 * resuelve el acceso por equipo (4.10.6), y una concesion individual seria un segundo camino que
 * la resolucion de ambito no consulta — la pantalla diria que alguien ve algo que no ve. Lo que
 * si se hace desde aqui es meter a esa persona en un equipo que ya lo tiene, que es el camino que
 * el modelo si reconoce.
 */
/** Los tres roles de 4.10.1. No son configurables, asi que la lista es fija a proposito. */
const ROLES = ['visor', 'colaborador', 'administrador'] as const;

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
  const router = useRouter();
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
    router.refresh();
  };

  if (acceso.nodeId === null) {
    return (
      <p className="aviso notice-atencion" data-testid="sin-nodo">
        {t('admin.access.notInTree')}
      </p>
    );
  }

  const conAcceso = acceso.equipos.filter((e) => e.alcanza);

  return (
    <>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="access-error">
          {error}
        </p>
      ) : null}

      <h3>{t('admin.access.teams')}</h3>
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
            {acceso.equipos.map((equipo) => (
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
                    Lo heredado no se revoca desde aqui: habria que quitarle al equipo la carpeta
                    entera, que es otra decision y afecta a mas modulos. Se dice, en vez de
                    ofrecer un boton que no haria lo que promete.
                  */}
                  {!equipo.directo && equipo.heredadoDe ? (
                    <span className="muted-text">{t('admin.access.inherited.revokeThere')}</span>
                  ) : (
                    <button
                      type="button"
                      className={equipo.directo ? 'boton-contorno' : 'pastilla'}
                      disabled={enCurso}
                      data-testid={`conceder-${equipo.teamId}`}
                      onClick={() =>
                        void enviar({
                          accion: 'equipo',
                          teamId: equipo.teamId,
                          conceder: !equipo.directo,
                        })
                      }
                    >
                      {equipo.directo ? t('admin.access.revoke') : t('admin.access.grant')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>{t('admin.access.people')}</h3>
      <p className="muted-text">{t('admin.access.people.intro')}</p>

      {conAcceso.length === 0 ? (
        <p className="muted-text" data-testid="nadie-lo-ve">
          {t('admin.access.nobody')}
        </p>
      ) : (
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

      <AnadirPersona
        equipos={conAcceso.map((e) => ({ id: e.teamId, nombre: e.nombre }))}
        personas={personas}
        enCurso={enCurso}
        onAnadir={(teamId, userId, role) =>
          void enviar({ accion: 'persona', teamId, userId, role, conceder: true })
        }
      />
    </>
  );
}

/**
 * Como llega el acceso: concedido aqui, heredado de una carpeta, o no llega.
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

/** Dar acceso a una persona: meterla en uno de los equipos que ya lo tienen. */
function AnadirPersona({
  equipos,
  personas,
  enCurso,
  onAnadir,
}: {
  equipos: { id: string; nombre: string }[];
  personas: { userId: string; nombre: string }[];
  enCurso: boolean;
  onAnadir: (teamId: string, userId: string, role: string) => void;
}) {
  const t = useTranslator();
  const [teamId, setTeamId] = useState(equipos[0]?.id ?? '');
  const [userId, setUserId] = useState(personas[0]?.userId ?? '');
  const [role, setRole] = useState('visor');

  if (equipos.length === 0 || personas.length === 0) return null;

  return (
    <form
      className="formulario-paquete"
      data-testid="anadir-persona"
      onSubmit={(e) => {
        e.preventDefault();
        onAnadir(teamId, userId, role);
      }}
    >
      <label className="form__field">
        <span>{t('admin.access.column.person')}</span>
        <select value={userId} data-testid="persona-nueva" onChange={(e) => setUserId(e.target.value)}>
          {personas.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="form__field">
        <span>{t('admin.access.column.through')}</span>
        <select value={teamId} data-testid="equipo-destino" onChange={(e) => setTeamId(e.target.value)}>
          {equipos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
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

      <button type="submit" className="pastilla" disabled={enCurso} data-testid="dar-acceso">
        {t('admin.access.grantPerson')}
      </button>
    </form>
  );
}
