import type { Cadence, Subscription } from './types';

/** Cuando toca entregar una suscripcion. */

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

/** true si la suscripcion tiene una entrega pendiente en el periodo actual. */
export function debeEntregarse(sub: Subscription, ahora: Date): boolean {
  if (!sub.enabled) return false;
  // Con un archivo ya en cola no se encola otro: dos vueltas seguidas entregarian dos veces.
  if (sub.pendingJobId) return false;

  const home = inicioDelPeriodo(sub.cadence, ahora);

  const programada = new Date(home);
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
