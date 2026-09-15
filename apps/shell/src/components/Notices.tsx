'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  cadenceDescribe,
  conditionDescribe,
  type AlertRule,
  type AlertState,
  type Notification,
  type Subscription,
} from '@app/alerts';
import { kindLabel } from './noticeKinds';
import { useTranslator } from './Locale';
import { pedir } from './pedir';

/** Bandeja de avisos: lo recibido, y lo que lo genera. */

type StatusRule = AlertRule & { estado: AlertState | null };

export function Notices() {
  const t = useTranslator();
  const [inbox, setBandeja] = useState<Notification[]>([]);
  const [rules, setReglas] = useState<StatusRule[]>([]);
  const [suscripciones, setSuscripciones] = useState<Subscription[]>([]);

  const recargar = useCallback(async () => {
    const [n, a, s] = await Promise.all([
      fetch('/api/notifications').then((r) => r.json()),
      fetch('/api/alerts').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
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
    const withoutRead = inbox.filter((n) => !n.readAt).map((n) => n.id);
    if (withoutRead.length === 0) return;
    void pedir('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: withoutRead }),
    });
  }, [inbox]);

  const borrar = async (tipo: 'alertas' | 'suscripciones', id: string) => {
    await pedir(`/api/${tipo}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await recargar();
  };

  return (
    <article className="avisos">
      <h1>{t('chrome.notices')}</h1>

      <h2>{t('notice.inbox')}</h2>
      {inbox.length === 0 ? (
        <p className="muted-text" data-testid="inbox-empty">
          No hay avisos. Los de una alerta llegan cuando su condicion empieza a cumplirse, y
          tambien cuando deja de cumplirse.
        </p>
      ) : (
        <ul className="simple-list" data-testid="bandeja">
          {inbox.map((n) => (
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
                      <Link href={n.link}>{t('notice.open')}</Link>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>{t('notice.myAlerts')}</h2>
      {rules.length === 0 ? (
        <p className="muted-text">{t('notice.myAlerts.empty')}</p>
      ) : (
        <ul className="simple-list" data-testid="alerts-list">
          {rules.map((r) => (
            <li key={r.id} className="regla" data-testid={`alert-${r.name}`}>
              <span>
                <strong>{r.name}</strong>
                <br />
                <span className="notice__target">
                  {r.measure} {conditionDescribe(r)} · {r.moduleSlug}
                  {r.estado?.triggered ? ' · disparada ahora mismo' : ''}
                </span>
              </span>
              <button
                type="button"
                className="button-link"
                data-testid={`delete-alert-${r.name}`}
                onClick={() => void borrar('alertas', r.id)}
              >
                {t('action.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>{t('notice.mySubscriptions')}</h2>
      {suscripciones.length === 0 ? (
        <p className="muted-text">{t('notice.mySubscriptions.empty')}</p>
      ) : (
        <ul className="simple-list" data-testid="list-subscriptions">
          {suscripciones.map((s) => (
            <li key={s.id} className="regla" data-testid={`subscription-${s.name}`}>
              <span>
                <strong>{s.name}</strong>
                <br />
                <span className="notice__target">
                  {cadenceDescribe(s)} · {s.format.toUpperCase()} · {s.moduleSlug}
                </span>
              </span>
              <button
                type="button"
                className="button-link"
                data-testid={`delete-subscription-${s.name}`}
                onClick={() => void borrar('suscripciones', s.id)}
              >
                {t('action.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
