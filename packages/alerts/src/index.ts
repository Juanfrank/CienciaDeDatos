/** Alertas y suscripciones basadas en datos — seccion 4.9. */
export {
  StoreAlertRepository,
  type IAlertStore,
} from './store';
export { deliverMust, cadenceDescribe, periodHome } from './calendario';
export {
  decidirNotificacion,
  conditionDescribe,
  linkOf,
  evaluateRule,
  messageOf,
  type Transition,
} from './evaluate';
export {
  InboxNotificationChannel,
  INBOX_MAX,
  withoutRead,
  type INotificationChannel,
} from './notificaciones';
export {
  STATES_KEY,
  KEY_RULES,
  SUBSCRIPTIONS_KEY,
  LAST_KEY_HEARTBEAT,
  inboxKey,
  type AlertCondition,
  type AlertEvaluation,
  type AlertOperator,
  type AlertRule,
  type AlertState,
  type Cadence,
  type Notification,
  type NotificationKind,
  type Observacion,
  type Subscription,
} from './types';
