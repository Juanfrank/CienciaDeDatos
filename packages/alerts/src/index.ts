/**
 * Alertas y suscripciones basadas en datos — seccion 4.9.
 *
 * Etiquetado `type:server`. No importa el repositorio de objetos: quien evalua le pasa las
 * observaciones ya calculadas, porque proyectar un objeto es cosa de quien sabe resolver el
 * ambito de su dueno. Aqui solo se compara, se decide si toca avisar y se guarda el estado.
 */
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
  sinLeer,
  type INotificationChannel,
} from './notificaciones';
export {
  CLAVE_ESTADOS,
  CLAVE_REGLAS,
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
