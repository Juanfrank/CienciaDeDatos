/**
 * Alertas y suscripciones basadas en datos — seccion 4.9.
 *
 * El documento las nombra en una linea y no las desarrolla, asi que el modelo lo fija este
 * repositorio. Dos decisiones lo ordenan todo, y las dos vienen del resto del contrato:
 *
 * 1. UNA ALERTA VIGILA LO QUE ALGUIEN VE, no una consulta suelta. Se define sobre un objeto de
 *    un modulo y se evalua bajo el AMBITO de su dueno, resuelto en el momento de evaluar. Sin
 *    eso, una alerta seria un canal por el que sacar cifras que su destinatario no puede ver:
 *    el principio 5 —aislamiento por seguridad— no admite excepciones por ser una notificacion.
 *
 * 2. SE EVALUAN CUANDO EL DATO CAMBIA, no en un reloj propio. El job de poblacion deja su
 *    latido en el cache al terminar un ciclo (seccion 7); esa marca es la senal. Una alerta
 *    "basada en datos" que se dispara por calendario evalua el mismo dato dos veces y se pierde
 *    el cambio que ocurre entre dos vueltas.
 */

export type AlertOperator = 'mayor-que' | 'menor-que' | 'cambia-mas-de';

export interface AlertCondition {
  operator: AlertOperator;
  threshold: number;
}

export interface AlertRule {
  id: string;
  name: string;
  ownerUserId: string;
  /**
   * Equipo bajo cuyo ambito se evalua.
   *
   * Se fija en la regla y no se toma del equipo activo al evaluar: una persona que pertenece a
   * dos equipos tiene dos ambitos distintos, y una alerta tiene que saber cual es el suyo. Es
   * la misma razon por la que 4.10.4 resuelve el ambito con el equipo ACTIVO y nunca con la
   * union de todos.
   */
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

/**
 * Estado persistido de una regla.
 *
 * Existe para no notificar en cada vuelta mientras la condicion sigue cumpliendose. Una alerta
 * que repite el mismo aviso cada media hora se desactiva a la semana, y entonces no avisa de
 * nada: se notifica en la TRANSICION, y tambien cuando deja de cumplirse, que suele ser la
 * mitad de la informacion.
 */
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

export const CLAVE_REGLAS = 'alerts:rules';
export const CLAVE_ESTADOS = 'alerts:states';
export const CLAVE_SUSCRIPCIONES = 'alerts:subscriptions';
export const claveBandeja = (userId: string): string => `alerts:inbox:${userId}`;

/** Marca del ultimo latido ya procesado, para no reevaluar el mismo ciclo de poblacion. */
export const CLAVE_ULTIMO_LATIDO = 'alerts:last-heartbeat';
