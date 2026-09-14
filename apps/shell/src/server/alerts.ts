import {
  InboxNotificationChannel,
  StoreAlertRepository,
  deliverMust,
  decidirNotificacion,
  evaluateRule,
  type AlertRule,
  type Notification,
  type Observacion,
  type Subscription,
} from '@app/alerts';
import { POPULATOR_HEARTBEAT_KEY, type PopulatorHeartbeat } from '@app/observability';
import { aggregateBy, aggregationsFor } from '@app/ui-components';
import { cacheL2 } from './context';
import { moduleLoad } from './data';
import { queueExports, exportEnqueue } from './exports';
import { userServableModule } from './cicloDeVida';

/** Cableado de alertas y suscripciones (4.9). */

export const alertStore = new StoreAlertRepository(cacheL2);
export const notificaciones = new InboxNotificationChannel(cacheL2);

const nuevoId = (): string => crypto.randomUUID();

/** Observaciones del objeto que vigila una regla. */
export async function observacionesDe(rule: AlertRule): Promise<Observacion[] | null> {
  const module = await userServableModule(rule.moduleSlug, rule.ownerUserId);
  if (!module) return null;

  const loaded = await moduleLoad({
    module,
    ...(rule.pageSlug ? { pageSlug: rule.pageSlug } : {}),
    userId: rule.ownerUserId,
    teamId: rule.teamId,
    requestedFilters: rule.filters,
  });
  if (!loaded) return null;

  const objeto = loaded.objetos.find((o) => o.item.instance.instanceId === rule.instanceId);
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
    aggregationsFor([rule.measure], measures, objeto.aggregations),
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

export interface EvaluationResult {
  evaluadas: number;
  notificadas: number;
  omitidas: number;
}

/** Evalua todas las reglas activas y notifica solo las transiciones. */
export async function evaluateAlerts(ahora = new Date()): Promise<EvaluationResult> {
  const rules = (await alertStore.listRules()).filter((r) => r.enabled);
  let notificadas = 0;
  let omitidas = 0;

  for (const colorRule of rules) {
    const observaciones = await observacionesDe(colorRule);

    // Una regla que ya no se puede evaluar se deja INTACTA: ni dispara ni se resuelve. Marcarla
    // como resuelta mandaria un "ya no se cumple" que nadie podria comprobar.
    if (observaciones === null) {
      omitidas += 1;
      continue;
    }

    const previo = await alertStore.getState(colorRule.id);
    const evaluation = evaluateRule(colorRule, observaciones, ahora, previo);
    const { estado, notificacion } = decidirNotificacion(colorRule, evaluation, previo, ahora);

    await alertStore.saveState(estado);

    if (notificacion) {
      await notificaciones.send({ ...notificacion, id: nuevoId() });
      notificadas += 1;
    }
  }

  return { evaluadas: rules.length - omitidas, notificadas, omitidas };
}

/** Evalua solo si el job ha completado un ciclo NUEVO desde la ultima vez. */
export async function evaluateIfHasDatumNew(ahora = new Date()): Promise<EvaluationResult | null> {
  const latido = await cacheL2.get<PopulatorHeartbeat>(POPULATOR_HEARTBEAT_KEY);
  const finishedAt = latido?.value.finishedAt;
  if (!finishedAt) return null;

  const procesado = await alertStore.getLastHeartbeat();
  if (procesado === finishedAt) return null;

  // Se marca ANTES de evaluar. Si evaluar falla a medias, el ciclo se da por procesado y no se
  // reintenta en bucle: la proxima poblacion traera un latido nuevo y otra oportunidad. Repetir
  // un ciclo que falla es como se llena una bandeja de avisos duplicados.
  await alertStore.setLastHeartbeat(finishedAt);
  return evaluateAlerts(ahora);
}

export interface SubscriptionsResult {
  encoladas: number;
  entregadas: number;
}

/** Atiende las suscripciones: encola lo que toca y entrega lo que ya esta listo. */
export async function subscriptionsServe(ahora = new Date()): Promise<SubscriptionsResult> {
  const suscripciones = await alertStore.listSubscriptions();
  let encoladas = 0;
  let entregadas = 0;

  for (const sub of suscripciones) {
    if (sub.pendingJobId) {
      if (await deliverIfThisReady(sub, ahora)) entregadas += 1;
      continue;
    }

    if (!deliverMust(sub, ahora)) continue;

    const job = await exportEnqueue({
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
      await notificaciones.send(failureNotice(sub, 'El modulo ya no existe.', ahora, nuevoId()));
      await alertStore.saveSubscription({ ...sub, enabled: false });
      continue;
    }

    await alertStore.saveSubscription({ ...sub, pendingJobId: job.id });
    encoladas += 1;
  }

  return { encoladas, entregadas };
}

async function deliverIfThisReady(sub: Subscription, ahora: Date): Promise<boolean> {
  const job = sub.pendingJobId ? await queueExports.consultar(sub.pendingJobId) : null;

  // El trabajo caduco del store antes de que nadie lo recogiera: se suelta el pendiente para
  // que la proxima vuelta vuelva a encolarlo, en vez de quedarse esperando para siempre.
  if (!job) {
    await alertStore.saveSubscription({ ...sub, pendingJobId: undefined });
    return false;
  }

  if (job.status === 'encolada' || job.status === 'procesando') return false;

  if (job.status === 'fallida' || !job.artifact) {
    await notificaciones.send(
      failureNotice(sub, job.error ?? 'No se pudo generar el archivo.', ahora, nuevoId()),
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

function failureNotice(sub: Subscription, motivo: string, ahora: Date, id: string): Notification {
  return {
    id,
    recipientUserId: sub.ownerUserId,
    kind: 'suscripcion',
    subject: `No se pudo entregar: ${sub.name}`,
    body: motivo,
    createdAt: ahora.toISOString(),
  };
}
