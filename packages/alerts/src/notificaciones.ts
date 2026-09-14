import type { CacheEntry, ICacheStore } from '@app/caching';
import { inboxKey, type Notification } from './types';

/** Canal de notificacion. */

export interface INotificationChannel {
  send(notification: Notification): Promise<void>;
  /** Bandeja de una persona, mas reciente primero. */
  list(userId: string): Promise<Notification[]>;
  markRead(userId: string, ids: string[]): Promise<void>;
}

/** Cuantas notificaciones se conservan por persona. Una bandeja infinita no la lee nadie. */
export const INBOX_MAX = 50;

export class InboxNotificationChannel implements INotificationChannel {
  constructor(private readonly store: ICacheStore) {}

  private entrada(value: Notification[]): CacheEntry<Notification[]> {
    return { value, generatedAt: new Date().toISOString() };
  }

  async send(notification: Notification): Promise<void> {
    const actuales = await this.list(notification.recipientUserId);
    const siguientes = [notification, ...actuales].slice(0, INBOX_MAX);
    await this.store.set(inboxKey(notification.recipientUserId), this.entrada(siguientes));
  }

  async list(userId: string): Promise<Notification[]> {
    const entry = await this.store.get<Notification[]>(inboxKey(userId));
    return entry?.value ?? [];
  }

  async markRead(userId: string, ids: string[]): Promise<void> {
    const marcar = new Set(ids);
    const actuales = await this.list(userId);
    const ahora = new Date().toISOString();
    const siguientes = actuales.map((n) =>
      marcar.has(n.id) && !n.readAt ? { ...n, readAt: ahora } : n,
    );
    await this.store.set(inboxKey(userId), this.entrada(siguientes));
  }
}

export const withoutRead = (notificaciones: Notification[]): number =>
  notificaciones.filter((n) => !n.readAt).length;
