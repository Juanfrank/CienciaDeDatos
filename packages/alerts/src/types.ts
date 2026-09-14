/** Alertas y suscripciones basadas en datos — seccion 4.9. */

export type AlertOperator = 'mayor-que' | 'menor-que' | 'cambia-mas-de';

export interface AlertCondition {
  operator: AlertOperator;
  threshold: number;
}

export interface AlertRule {
  id: string;
  name: string;
  ownerUserId: string;
  /** Equipo bajo cuyo ambito se evalua. */
  teamId: string;
  moduleSlug: string;
  pageSlug?: string;
  /** Objeto vigilado dentro del modulo. */
  instanceId: string;
  /** Medida vigilada, de entre las que el objeto mapea. */
  measure: string;
  condition: AlertCondition;
  /** Filtros fijados en la regla, igual que en un marcador (4.11). */
  filters: Record<string, string[]>;
  enabled: boolean;
  createdAt: string;
}

/** Un valor observado del objeto vigilado: una categoria y su cifra. */
export interface Observacion {
  label: string;
  value: number;
}

export interface AlertEvaluation {
  ruleId: string;
  triggered: boolean;
  /** Las observaciones que cumplen la condicion. Vacio si no se cumple. */
  matches: Observacion[];
  /** Suma de todas las observaciones, para el mensaje y para 'cambia-mas-de'. */
  total: number;
  observedAt: string;
}

/** Estado persistido de una regla. */
export interface AlertState {
  ruleId: string;
  triggered: boolean;
  lastValue?: number;
  lastNotifiedAt?: string;
  lastEvaluatedAt?: string;
}

export type Cadence = 'diaria' | 'semanal' | 'mensual';

export interface Subscription {
  id: string;
  name: string;
  ownerUserId: string;
  teamId: string;
  moduleSlug: string;
  pageSlug?: string;
  filters: Record<string, string[]>;
  /** Formato del archivo entregado. Se genera por la cola de exportacion (5.3). */
  format: 'csv' | 'xlsx' | 'pdf' | 'svg';
  cadence: Cadence;
  /** Hora de entrega, 0-23. */
  hour: number;
  /** Dia de la semana (0 domingo) para la cadencia semanal. */
  weekday?: number;
  /** Dia del mes para la cadencia mensual. */
  monthday?: number;
  enabled: boolean;
  lastDeliveredAt?: string;
  /** Trabajo de exportacion en curso, mientras se genera el archivo. */
  pendingJobId?: string;
}

export type NotificationKind = 'alerta' | 'alerta-resuelta' | 'suscripcion';

export interface Notification {
  id: string;
  recipientUserId: string;
  kind: NotificationKind;
  subject: string;
  body: string;
  /** Ruta dentro de la aplicacion: el modulo vigilado, o la descarga del archivo. */
  link?: string;
  createdAt: string;
  readAt?: string;
}

export const KEY_RULES = 'alerts:rules';
export const STATES_KEY = 'alerts:states';
export const SUBSCRIPTIONS_KEY = 'alerts:subscriptions';
export const inboxKey = (userId: string): string => `alerts:inbox:${userId}`;

/** Marca del ultimo latido ya procesado, para no reevaluar el mismo ciclo de poblacion. */
export const LAST_KEY_HEARTBEAT = 'alerts:last-heartbeat';
