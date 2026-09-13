import type { CacheEntry, ICacheStore } from '@app/caching';
import {
  CLAVE_ESTADOS,
  KEY_RULES,
  CLAVE_SUSCRIPCIONES,
  CLAVE_ULTIMO_LATIDO,
  type AlertRule,
  type AlertState,
  type Subscription,
} from './types';

/** Almacen de reglas, estados y suscripciones. */

export interface IAlertStore {
  listRules(): Promise<AlertRule[]>;
  saveRule(rule: AlertRule): Promise<void>;
  deleteRule(id: string, ownerUserId: string): Promise<boolean>;

  getState(ruleId: string): Promise<AlertState | undefined>;
  saveState(state: AlertState): Promise<void>;

  listSubscriptions(): Promise<Subscription[]>;
  saveSubscription(sub: Subscription): Promise<void>;
  deleteSubscription(id: string, ownerUserId: string): Promise<boolean>;

  /** Latido de poblacion ya procesado, para no reevaluar dos veces el mismo ciclo. */
  getLastHeartbeat(): Promise<string | undefined>;
  setLastHeartbeat(finishedAt: string): Promise<void>;
}

const entrada = <T>(value: T): CacheEntry<T> => ({
  value,
  generatedAt: new Date().toISOString(),
});

export class StoreAlertRepository implements IAlertStore {
  constructor(private readonly store: ICacheStore) {}

  private async leer<T>(clave: string): Promise<T[]> {
    const entry = await this.store.get<T[]>(clave);
    return entry?.value ?? [];
  }

  async listRules(): Promise<AlertRule[]> {
    return this.leer<AlertRule>(KEY_RULES);
  }

  async saveRule(rule: AlertRule): Promise<void> {
    const rules = await this.listRules();
    const sinEsta = rules.filter((r) => r.id !== rule.id);
    await this.store.set(KEY_RULES, entrada([...sinEsta, rule]));
  }

  /** Borrar exige el dueno, no solo el id. */
  async deleteRule(id: string, ownerUserId: string): Promise<boolean> {
    const rules = await this.listRules();
    const objetivo = rules.find((r) => r.id === id);
    if (!objetivo || objetivo.ownerUserId !== ownerUserId) return false;

    await this.store.set(KEY_RULES, entrada(rules.filter((r) => r.id !== id)));
    await this.store.delete(`${CLAVE_ESTADOS}:${id}`);
    return true;
  }

  async getState(ruleId: string): Promise<AlertState | undefined> {
    const entry = await this.store.get<AlertState>(`${CLAVE_ESTADOS}:${ruleId}`);
    return entry?.value ?? undefined;
  }

  async saveState(state: AlertState): Promise<void> {
    await this.store.set(`${CLAVE_ESTADOS}:${state.ruleId}`, entrada(state));
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return this.leer<Subscription>(CLAVE_SUSCRIPCIONES);
  }

  async saveSubscription(sub: Subscription): Promise<void> {
    const subs = await this.listSubscriptions();
    const sinEsta = subs.filter((s) => s.id !== sub.id);
    await this.store.set(CLAVE_SUSCRIPCIONES, entrada([...sinEsta, sub]));
  }

  async deleteSubscription(id: string, ownerUserId: string): Promise<boolean> {
    const subs = await this.listSubscriptions();
    const objetivo = subs.find((s) => s.id === id);
    if (!objetivo || objetivo.ownerUserId !== ownerUserId) return false;

    await this.store.set(CLAVE_SUSCRIPCIONES, entrada(subs.filter((s) => s.id !== id)));
    return true;
  }

  async getLastHeartbeat(): Promise<string | undefined> {
    const entry = await this.store.get<string>(CLAVE_ULTIMO_LATIDO);
    return entry?.value ?? undefined;
  }

  async setLastHeartbeat(finishedAt: string): Promise<void> {
    await this.store.set(CLAVE_ULTIMO_LATIDO, entrada(finishedAt));
  }
}
