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
import { kindLabel } from './Campana';

/** Bandeja de avisos: lo recibido, y lo que lo genera. */

type ReglaConEstado = AlertRule & { estado: AlertState | null };

export function Avisos() {
  const [bandeja, setBandeja] = useState<Notification[]>([]);
  const [rules, setReglas] = useState<ReglaConEstado[]>([]);
  const [suscripciones, setSuscripciones] = useState<Subscription[]>([]);

  const recargar = useCallback(async () => {
    const [n, a, s] = await Promise.all([
      fetch('/api/notificaciones').then((r) => r.json()),
      fetch('/api/alertas').then((r) => r.json()),
      fetch('/api/suscripciones').then((r) => r.json()),
    ]);
    setBandeja(n.notificaciones as Notification[]);
    setReglas(a.alertas as ReglaConEstado[]);
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
        <p className="texto-atenuado" data-testid="bandeja-vacia">
          No hay notices. Los de una alerta llegan cuando su condicion empieza a cumplirse, y
          tambien cuando deja de cumplirse.
        </p>
      ) : (
        <ul className="lista-simple" data-testid="bandeja">
          {bandeja.map((n) => (
            <li
              key={n.id}
              className={`aviso ${n.readAt ? '' : 'aviso--sin-leer'}`}
              data-testid={`aviso-${n.id}`}
            >
              <div className="aviso__cuerpo">
                <p className="aviso__asunto">
                  <span className="insignia">{kindLabel[n.kind]}</span> {n.subject}
                </p>
                <p>{n.body}</p>
                <p className="aviso__meta">
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
        <p className="texto-atenuado">
          Ninguna. Se crean desde un objeto del modulo que se quiera vigilar.
        </p>
      ) : (
        <ul className="lista-simple" data-testid="lista-alertas">
          {rules.map((r) => (
            <li key={r.id} className="regla" data-testid={`alerta-${r.name}`}>
              <span>
                <strong>{r.name}</strong>
                <br />
                <span className="aviso__meta">
                  {r.measure} {describirCondicion(r)} · {r.moduleSlug}
                  {r.estado?.triggered ? ' · disparada ahora mismo' : ''}
                </span>
              </span>
              <button
                type="button"
                className="boton-enlace"
                data-testid={`borrar-alerta-${r.name}`}
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
        <p className="texto-atenuado">
          Ninguna. Se crean desde el modulo que se quiera recibir.
        </p>
      ) : (
        <ul className="lista-simple" data-testid="lista-suscripciones">
          {suscripciones.map((s) => (
            <li key={s.id} className="regla" data-testid={`suscripcion-${s.name}`}>
              <span>
                <strong>{s.name}</strong>
                <br />
                <span className="aviso__meta">
                  {describirCadencia(s)} · {s.format.toUpperCase()} · {s.moduleSlug}
                </span>
              </span>
              <button
                type="button"
                className="boton-enlace"
                data-testid={`borrar-suscripcion-${s.name}`}
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
