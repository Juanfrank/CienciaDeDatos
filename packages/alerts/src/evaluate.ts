import type {
  AlertEvaluation,
  AlertRule,
  AlertState,
  Notification,
  Observacion,
} from './types';

/** Evaluacion de una regla y decision de notificar. */

const formatear = (n: number): string => new Intl.NumberFormat('es-DO').format(Math.round(n));

export function evaluateRule(
  rule: AlertRule,
  observaciones: Observacion[],
  ahora: Date,
  estadoPrevio?: AlertState,
): AlertEvaluation {
  const total = observaciones.reduce((t, o) => t + o.value, 0);
  const { operator, threshold } = rule.condition;

  let matches: Observacion[] = [];

  if (operator === 'mayor-que') {
    matches = observaciones.filter((o) => o.value > threshold);
  } else if (operator === 'menor-que') {
    matches = observaciones.filter((o) => o.value < threshold);
  } else {
    // 'cambia-mas-de' compara contra la ULTIMA evaluacion, no contra un umbral fijo. Sin valor
    // previo no hay cambio que medir: la primera vuelta establece la linea base y no dispara.
    // Disparar ahi convertiria cada alerta nueva en un aviso inmediato y sin sentido.
    const previo = estadoPrevio?.lastValue;
    if (previo !== undefined && Math.abs(total - previo) > threshold) {
      matches = [{ label: 'total', value: total }];
    }
  }

  return {
    ruleId: rule.id,
    triggered: matches.length > 0,
    matches,
    total,
    observedAt: ahora.toISOString(),
  };
}

export interface Transition {
  /** Estado a guardar tras esta evaluacion. */
  estado: AlertState;
  /** La notificacion a enviar, si la hay. */
  notificacion?: Omit<Notification, 'id'>;
}

/** Decide si esta evaluacion merece aviso. */
export function decidirNotificacion(
  rule: AlertRule,
  evaluation: AlertEvaluation,
  estadoPrevio: AlertState | undefined,
  ahora: Date,
): Transition {
  const before = estadoPrevio?.triggered ?? false;
  const ahoraDispara = evaluation.triggered;

  const estado: AlertState = {
    ruleId: rule.id,
    triggered: ahoraDispara,
    lastValue: evaluation.total,
    lastEvaluatedAt: ahora.toISOString(),
    ...(estadoPrevio?.lastNotifiedAt ? { lastNotifiedAt: estadoPrevio.lastNotifiedAt } : {}),
  };

  if (before === ahoraDispara) return { estado };

  estado.lastNotifiedAt = ahora.toISOString();

  return {
    estado,
    notificacion: {
      recipientUserId: rule.ownerUserId,
      kind: ahoraDispara ? 'alerta' : 'alerta-resuelta',
      subject: ahoraDispara ? `Alerta: ${rule.name}` : `Resuelta: ${rule.name}`,
      body: messageOf(rule, evaluation, ahoraDispara),
      link: linkOf(rule),
      createdAt: ahora.toISOString(),
    },
  };
}

export function messageOf(
  rule: AlertRule,
  evaluation: AlertEvaluation,
  dispara: boolean,
): string {
  const condicion = conditionDescribe(rule);

  if (!dispara) {
    return `${rule.measure} ya no cumple la condicion (${condicion}). Valor actual: ${formatear(evaluation.total)}.`;
  }

  if (rule.condition.operator === 'cambia-mas-de') {
    return `${rule.measure} cambio mas de ${formatear(rule.condition.threshold)}. Valor actual: ${formatear(evaluation.total)}.`;
  }

  // Se nombran las categorias que cumplen, no solo el total: "hay algo por encima del umbral"
  // obliga a abrir el modulo y buscarlo, y una alerta que no dice donde mirar vale poco.
  const detalle = evaluation.matches
    .slice(0, 5)
    .map((m) => `${m.label}: ${formatear(m.value)}`)
    .join('; ');
  const resto =
    evaluation.matches.length > 5 ? ` y ${evaluation.matches.length - 5} mas` : '';

  return `${rule.measure} ${condicion}. ${detalle}${resto}.`;
}

export function conditionDescribe(rule: AlertRule): string {
  const { operator, threshold } = rule.condition;
  const valor = formatear(threshold);
  if (operator === 'mayor-que') return `supera ${valor}`;
  if (operator === 'menor-que') return `baja de ${valor}`;
  return `cambia mas de ${valor}`;
}

/** Enlace al modulo vigilado, con los filtros de la regla: la URL es el estado (4.11). */
export function linkOf(rule: Pick<AlertRule, 'moduleSlug' | 'pageSlug' | 'filters'>): string {
  const base = rule.pageSlug ? `/m/${rule.moduleSlug}/${rule.pageSlug}` : `/m/${rule.moduleSlug}`;
  const params = new URLSearchParams();
  for (const [fieldName, valores] of Object.entries(rule.filters)) {
    for (const v of valores) params.append(fieldName, v);
  }
  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}
