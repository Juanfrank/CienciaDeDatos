import type { CacheEntry, ICacheStore } from '@app/caching';
import { claveBandeja, type Notification } from './types';

/**
 * Canal de notificacion.
 *
 * El contrato pide alertas y suscripciones pero no fija el canal, asi que se define como puerto
 * —el mismo patron que IDataConnector, ICacheStore e IExportQueue— y se implementa la bandeja
 * dentro de la aplicacion, que es la que se puede construir y probar hoy. El correo entra
 * despues como otra implementacion de esta misma interfaz, sin tocar ni la evaluacion ni la
 * interfaz de usuario.
 *
 * Una nota deliberada sobre el contenido: la notificacion lleva CIFRAS, porque una alerta que
 * solo dice "algo paso" obliga a abrir la aplicacion y no sirve de alerta. Eso esta bien en la
 * bandeja interna, donde quien lee ya se autentico. El dia que se anada correo, el adaptador
 * tendra que decidir si esas cifras salen del perimetro o si el mensaje se queda en un enlace:
 * es una decision de la institucion, no del codigo, y por eso queda en el adaptador y no aqui.
 */

export interface INotificationChannel {
  send(notification: Notification): Promise<void>;
  /** Bandeja de una persona, mas reciente primero. */
  list(userId: string): Promise<Notification[]>;
  markRead(userId: string, ids: string[]): Promise<void>;
}

/** Cuantas notificaciones se conservan por persona. Una bandeja infinita no la lee nadie. */
export const MAXIMO_POR_BANDEJA = 50;

export class InboxNotificationChannel implements INotificationChannel {
  constructor(private readonly store: ICacheStore) {}

  private entrada(value: Notification[]): CacheEntry<Notification[]> {
    return { value, generatedAt: new Date().toISOString() };
  }

  async send(notification: Notification): Promise<void> {
    const actuales = await this.list(notification.recipientUserId);
    const siguientes = [notification, ...actuales].slice(0, MAXIMO_POR_BANDEJA);
    await this.store.set(claveBandeja(notification.recipientUserId), this.entrada(siguientes));
  }

  async list(userId: string): Promise<Notification[]> {
    const entry = await this.store.get<Notification[]>(claveBandeja(userId));
    return entry?.value ?? [];
  }

  async markRead(userId: string, ids: string[]): Promise<void> {
    const marcar = new Set(ids);
    const actuales = await this.list(userId);
    const ahora = new Date().toISOString();
    const siguientes = actuales.map((n) =>
      marcar.has(n.id) && !n.readAt ? { ...n, readAt: ahora } : n,
    );
    await this.store.set(claveBandeja(userId), this.entrada(siguientes));
  }
}

export const sinLeer = (notificaciones: Notification[]): number =>
  notificaciones.filter((n) => !n.readAt).length;
