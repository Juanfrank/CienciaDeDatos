/** Alertas y suscripciones basadas en datos — seccion 4.9. */
export {
  StoreAlertRepository,
  type IAlertStore,
} from './almacen';
export { debeEntregarse, describirCadencia, inicioDelPeriodo } from './calendario';
export {
  decidirNotificacion,
  describirCondicion,
  enlaceDe,
  evaluarRegla,
  mensajeDe,
  type Transicion,
} from './evaluar';
export {
  InboxNotificationChannel,
  MAXIMO_POR_BANDEJA,
  withoutRead,
  type INotificationChannel,
} from './notificaciones';
export {
  CLAVE_ESTADOS,
  KEY_RULES,
  CLAVE_SUSCRIPCIONES,
  CLAVE_ULTIMO_LATIDO,
  claveBandeja,
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
