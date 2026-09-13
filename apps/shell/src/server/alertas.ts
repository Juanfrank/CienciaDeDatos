import {
  InboxNotificationChannel,
  StoreAlertRepository,
  debeEntregarse,
  decidirNotificacion,
  evaluarRegla,
  type AlertRule,
  type Notification,
  type Observacion,
  type Subscription,
} from '@app/alerts';
import { POPULATOR_HEARTBEAT_KEY, type PopulatorHeartbeat } from '@app/observability';
import { aggregateBy, agregacionesPara } from '@app/ui-components';
import { cacheL2 } from './contexto';
import { cargarModulo } from './datos';
import { colaExportaciones, encolarExportacion } from './exportaciones';
import { moduloServibleParaUsuario } from './cicloDeVida';

/**
 * Cableado de alertas y suscripciones (4.9).
 *
 * Aqui esta la decision de seguridad de la funcion entera: una regla se evalua con
 * `cargarModulo` bajo el USUARIO Y EQUIPO que la crearon, igual que la exportacion. La
 * alternativa —evaluar la condicion sobre el dataset sin ambito y mandar el numero— convertiria
 * una notificacion en un canal por el que salen cifras que su destinatario no puede ver. El
 * principio 5 no tiene una excepcion para las alertas.
 *
 * Y se evalua CUANDO EL DATO CAMBIA: el disparador es el latido que el job deja en el cache al
 * terminar un ciclo de poblacion (seccion 7), no un reloj propio. Una alerta "basada en datos"
 * con reloj propio evalua dos veces el mismo dato y se pierde el cambio que ocurre entre vueltas.
 */

export const alertStore = new StoreAlertRepository(cacheL2);
export const notificaciones = new InboxNotificationChannel(cacheL2);

const nuevoId = (): string => crypto.randomUUID();

/**
 * Observaciones del objeto que vigila una regla.
 *
 * Devuelve `null` —y no una lista vacia— cuando el modulo o el objeto ya no existen, o cuando el
 * equipo dejo de tener concedido el modulo. La diferencia importa: una lista vacia significa
 * "no hay nada que cumpla la condicion" y podria RESOLVER una alerta que en realidad ya no se
 * puede evaluar.
 */
export async function observacionesDe(rule: AlertRule): Promise<Observacion[] | null> {
  const module = await moduloServibleParaUsuario(rule.moduleSlug, rule.ownerUserId);
  if (!module) return null;

  const cargado = await cargarModulo({
    module,
    ...(rule.pageSlug ? { pageSlug: rule.pageSlug } : {}),
    userId: rule.ownerUserId,
    teamId: rule.teamId,
    requestedFilters: rule.filters,
  });
  if (!cargado) return null;

  const objeto = cargado.objetos.find((o) => o.item.instance.instanceId === rule.instanceId);
  if (!objeto?.result || objeto.problems.length > 0) return null;

  const { dimensions, measures } = objeto.item.instance.binding;
  // Se agrega por las dimensiones del objeto y por la medida vigilada: la regla se definio
  // sobre las categorias que el objeto MUESTRA, no sobre las filas del dataset. Y con el MISMO
  // operador con que el objeto la dibuja: una alerta que sumara lo que la pantalla promedia
  // dispararia por un umbral que nadie ve.
  const { rows } = aggregateBy(
    objeto.result,
    dimensions,
    [rule.measure],
    agregacionesPara([rule.measure], measures, objeto.agregaciones),
  );

  return rows
    // Una observacion sin respuesta no se compara contra el umbral: no es un cero, es que no hay
    // cifra. Evaluarla como cero dispararia toda regla de "por debajo de".
    .filter((f) => f.values[0] !== null && f.values[0] !== undefined)
    .map((f) => ({
      // Un objeto sin dimensiones (una tarjeta KPI) da una sola observacion: su total.
      label: f.labels.join(' / ') || 'total',
      value: f.values[0] as number,
    }));
}

export interface ResultadoDeEvaluacion {
  evaluadas: number;
  notificadas: number;
  omitidas: number;
}

/** Evalua todas las reglas activas y notifica solo las transiciones. */
export async function evaluarAlertas(ahora = new Date()): Promise<ResultadoDeEvaluacion> {
  const reglas = (await alertStore.listRules()).filter((r) => r.enabled);
  let notificadas = 0;
  let omitidas = 0;

  for (const regla of reglas) {
    const observaciones = await observacionesDe(regla);

    // Una regla que ya no se puede evaluar se deja INTACTA: ni dispara ni se resuelve. Marcarla
    // como resuelta mandaria un "ya no se cumple" que nadie podria comprobar.
    if (observaciones === null) {
      omitidas += 1;
      continue;
    }

    const previo = await alertStore.getState(regla.id);
    const evaluacion = evaluarRegla(regla, observaciones, ahora, previo);
    const { estado, notificacion } = decidirNotificacion(regla, evaluacion, previo, ahora);

    await alertStore.saveState(estado);

    if (notificacion) {
      await notificaciones.send({ ...notificacion, id: nuevoId() });
      notificadas += 1;
    }
  }

  return { evaluadas: reglas.length - omitidas, notificadas, omitidas };
}

/**
 * Evalua solo si el job ha completado un ciclo NUEVO desde la ultima vez.
 *
 * Sin esta comprobacion, el bucle del trabajador reevaluaria las mismas cifras cada pocos
 * segundos: mucho trabajo para nada, y ninguna transicion que notificar.
 */
export async function evaluarSiHayDatoNuevo(ahora = new Date()): Promise<ResultadoDeEvaluacion | null> {
  const latido = await cacheL2.get<PopulatorHeartbeat>(POPULATOR_HEARTBEAT_KEY);
  const finishedAt = latido?.value.finishedAt;
  if (!finishedAt) return null;

  const procesado = await alertStore.getLastHeartbeat();
  if (procesado === finishedAt) return null;

  // Se marca ANTES de evaluar. Si evaluar falla a medias, el ciclo se da por procesado y no se
  // reintenta en bucle: la proxima poblacion traera un latido nuevo y otra oportunidad. Repetir
  // un ciclo que falla es como se llena una bandeja de avisos duplicados.
  await alertStore.setLastHeartbeat(finishedAt);
  return evaluarAlertas(ahora);
}

export interface ResultadoDeSuscripciones {
  encoladas: number;
  entregadas: number;
}

/**
 * Atiende las suscripciones: encola lo que toca y entrega lo que ya esta listo.
 *
 * La generacion del archivo NO ocurre aqui: se encola en la misma cola de exportacion que usa
 * el boton de exportar (5.3). Una suscripcion es, exactamente, una exportacion programada, y
 * darle un camino propio duplicaria la generacion de archivos y la puerta de ambito con ella.
 */
export async function atenderSuscripciones(ahora = new Date()): Promise<ResultadoDeSuscripciones> {
  const suscripciones = await alertStore.listSubscriptions();
  let encoladas = 0;
  let entregadas = 0;

  for (const sub of suscripciones) {
    if (sub.pendingJobId) {
      if (await entregarSiEstaListo(sub, ahora)) entregadas += 1;
      continue;
    }

    if (!debeEntregarse(sub, ahora)) continue;

    const job = await encolarExportacion({
      moduleSlug: sub.moduleSlug,
      ...(sub.pageSlug ? { pageSlug: sub.pageSlug } : {}),
      format: sub.format,
      userId: sub.ownerUserId,
      teamId: sub.teamId,
      appliedFilters: sub.filters,
    });

    if (!job) {
      // El modulo ya no existe. Se avisa en vez de callar: una suscripcion que deja de llegar
      // sin decir nada se interpreta como que no hay novedades.
      await notificaciones.send(avisoDeFallo(sub, 'El modulo ya no existe.', ahora, nuevoId()));
      await alertStore.saveSubscription({ ...sub, enabled: false });
      continue;
    }

    await alertStore.saveSubscription({ ...sub, pendingJobId: job.id });
    encoladas += 1;
  }

  return { encoladas, entregadas };
}

async function entregarSiEstaListo(sub: Subscription, ahora: Date): Promise<boolean> {
  const job = sub.pendingJobId ? await colaExportaciones.consultar(sub.pendingJobId) : null;

  // El trabajo caduco del store antes de que nadie lo recogiera: se suelta el pendiente para
  // que la proxima vuelta vuelva a encolarlo, en vez de quedarse esperando para siempre.
  if (!job) {
    await alertStore.saveSubscription({ ...sub, pendingJobId: undefined });
    return false;
  }

  if (job.status === 'encolada' || job.status === 'procesando') return false;

  if (job.status === 'fallida' || !job.artifact) {
    await notificaciones.send(
      avisoDeFallo(sub, job.error ?? 'No se pudo generar el archivo.', ahora, nuevoId()),
    );
  } else {
    await notificaciones.send({
      id: nuevoId(),
      recipientUserId: sub.ownerUserId,
      kind: 'suscripcion',
      subject: sub.name,
      body: `${job.artifact.filename} — ${Math.max(1, Math.round(job.artifact.bytes / 1024))} KB.`,
      link: `/api/exportaciones/${job.id}/descarga`,
      createdAt: ahora.toISOString(),
    });
  }

  await alertStore.saveSubscription({
    ...sub,
    pendingJobId: undefined,
    lastDeliveredAt: ahora.toISOString(),
  });
  return true;
}

function avisoDeFallo(sub: Subscription, motivo: string, ahora: Date, id: string): Notification {
  return {
    id,
    recipientUserId: sub.ownerUserId,
    kind: 'suscripcion',
    subject: `No se pudo entregar: ${sub.name}`,
    body: motivo,
    createdAt: ahora.toISOString(),
  };
}
