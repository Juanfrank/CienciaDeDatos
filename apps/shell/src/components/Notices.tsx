'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  describirCadencia,
  describirCondicion,
  type AlertRule,
  type AlertState,
  type Notification,
  type Subscription,
} from '@app/alerts';
import { kindLabel } from './Bell';

/** Bandeja de avisos: lo recibido, y lo que lo genera. */

type StatusRule = AlertRule & { estado: AlertState | null };

export function Notices() {
  const [bandeja, setBandeja] = useState<Notification[]>([]);
  const [rules, setReglas] = useState<StatusRule[]>([]);
  const [suscripciones, setSuscripciones] = useState<Subscription[]>([]);

  const recargar = useCallback(async () => {
    const [n, a, s] = await Promise.all([
      fetch('/api/notificaciones').then((r) => r.json()),
      fetch('/api/alertas').then((r) => r.json()),
      fetch('/api/suscripciones').then((r) => r.json()),
    ]);
    setBandeja(n.notificaciones as Notification[]);
    setReglas(a.alertas as StatusRule[]);
    setSuscripciones(s.suscripciones as Subscription[]);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // Abrir la bandeja es haberla leido. Un contador que sigue en rojo despues de mirar los
  // avisos ensena a la gente a ignorarlo.
  useEffect(() => {
    const withoutRead = bandeja.filter((n) => !n.readAt).map((n) => n.id);
    if (withoutRead.length === 0) return;
    void fetch('/api/notificaciones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: withoutRead }),
    });
  }, [bandeja]);

  const borrar = async (tipo: 'alertas' | 'suscripciones', id: string) => {
    await fetch(`/api/${tipo}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await recargar();
  };

  return (
    <article className="avisos">
      <h1>Avisos</h1>

      <h2>Bandeja</h2>
      {bandeja.length === 0 ? (
        <p className="muted-text" data-testid="bandeja-vacia">
          No hay avisos. Los de una alerta llegan cuando su condicion empieza a cumplirse, y
          tambien cuando deja de cumplirse.
        </p>
      ) : (
        <ul className="simple-list" data-testid="bandeja">
          {bandeja.map((n) => (
            <li
              key={n.id}
              className={`aviso ${n.readAt ? '' : 'notice-without-read'}`}
              data-testid={`notice-${n.id}`}
            >
              <div className="notice__body">
                <p className="notice__asunto">
                  <span className="insignia">{kindLabel[n.kind]}</span> {n.subject}
                </p>
                <p>{n.body}</p>
                <p className="notice__target">
                  {new Date(n.createdAt).toLocaleString('es-DO')}
                  {n.link ? (
                    <>
                      {' · '}
                      <Link href={n.link}>Abrir</Link>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Mis alertas</h2>
      {rules.length === 0 ? (
        <p className="muted-text">
          Ninguna. Se crean desde un objeto del modulo que se quiera vigilar.
        </p>
      ) : (
        <ul className="simple-list" data-testid="alerts-list">
          {rules.map((r) => (
            <li key={r.id} className="regla" data-testid={`alert-${r.name}`}>
              <span>
                <strong>{r.name}</strong>
                <br />
                <span className="notice__target">
                  {r.measure} {describirCondicion(r)} · {r.moduleSlug}
                  {r.estado?.triggered ? ' · disparada ahora mismo' : ''}
                </span>
              </span>
              <button
                type="button"
                className="boton-enlace"
                data-testid={`delete-alert-${r.name}`}
                onClick={() => void borrar('alertas', r.id)}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Mis suscripciones</h2>
      {suscripciones.length === 0 ? (
        <p className="muted-text">
          Ninguna. Se crean desde el modulo que se quiera recibir.
        </p>
      ) : (
        <ul className="simple-list" data-testid="lista-suscripciones">
          {suscripciones.map((s) => (
            <li key={s.id} className="regla" data-testid={`subscription-${s.name}`}>
              <span>
                <strong>{s.name}</strong>
                <br />
                <span className="notice__target">
                  {describirCadencia(s)} · {s.format.toUpperCase()} · {s.moduleSlug}
                </span>
              </span>
              <button
                type="button"
                className="boton-enlace"
                data-testid={`delete-subscription-${s.name}`}
                onClick={() => void borrar('suscripciones', s.id)}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
