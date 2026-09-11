import type { Cadence, Subscription } from './types';

/**
 * Cuando toca entregar una suscripcion.
 *
 * Funcion pura sobre la hora actual y la ultima entrega. Se decide aqui, y no con un temporizador
 * por suscripcion, porque el proceso que las atiende se reinicia con cada despliegue y con cada
 * reciclado de instancia del App Service: un temporizador en memoria perderia las entregas y
 * nadie se enteraria. Preguntar "¿toca ya?" en cada vuelta sobrevive a los reinicios.
 */

/** Inicio del periodo al que pertenece `ahora` para una cadencia dada. */
export function inicioDelPeriodo(cadencia: Cadence, ahora: Date): Date {
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);

  if (cadencia === 'semanal') {
    d.setDate(d.getDate() - d.getDay());
  } else if (cadencia === 'mensual') {
    d.setDate(1);
  }

  return d;
}

/**
 * true si la suscripcion tiene una entrega pendiente en el periodo actual.
 *
 * Compara contra el PERIODO y no contra "han pasado N horas": si el proceso estuvo caido a la
 * hora exacta, la entrega sigue debiendose al volver, en vez de perderse hasta el periodo
 * siguiente. Y si ya se entrego en este periodo, no se repite aunque el proceso se reinicie.
 */
export function debeEntregarse(sub: Subscription, ahora: Date): boolean {
  if (!sub.enabled) return false;
  // Con un archivo ya en cola no se encola otro: dos vueltas seguidas entregarian dos veces.
  if (sub.pendingJobId) return false;

  const inicio = inicioDelPeriodo(sub.cadence, ahora);

  const programada = new Date(inicio);
  if (sub.cadence === 'semanal' && sub.weekday !== undefined) {
    programada.setDate(programada.getDate() + sub.weekday);
  }
  if (sub.cadence === 'mensual' && sub.monthday !== undefined) {
    // Un dia 31 en febrero no existe: se entrega el ultimo dia del mes en vez de saltarse el
    // periodo entero, que es lo que haria una comparacion literal de fecha.
    const ultimoDia = new Date(programada.getFullYear(), programada.getMonth() + 1, 0).getDate();
    programada.setDate(Math.min(sub.monthday, ultimoDia));
  }
  programada.setHours(sub.hour, 0, 0, 0);

  if (ahora < programada) return false;

  if (!sub.lastDeliveredAt) return true;
  return new Date(sub.lastDeliveredAt) < programada;
}

/** Descripcion legible de la cadencia, para la interfaz. */
export function describirCadencia(sub: Subscription): string {
  const hora = `${String(sub.hour).padStart(2, '0')}:00`;
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  if (sub.cadence === 'diaria') return `Cada dia a las ${hora}`;
  if (sub.cadence === 'semanal') {
    return `Cada ${dias[sub.weekday ?? 1] ?? 'lunes'} a las ${hora}`;
  }
  return `El dia ${sub.monthday ?? 1} de cada mes a las ${hora}`;
}
