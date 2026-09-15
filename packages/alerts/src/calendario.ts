import type { Cadence, Subscription } from './types';

/** Cuando toca entregar una suscripcion. */

/** Inicio del periodo al que pertenece `ahora` para una cadencia dada. */
export function periodHome(cadencia: Cadence, ahora: Date): Date {
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
 * El dia configurado, o `undefined` si no sirve.
 *
 * El calendario no se fia de lo que tiene guardado. Un `weekday` que no sea un numero entero
 * dentro de rango produce una fecha invalida, y una fecha invalida compara `false` con todo:
 * `ahora < programada` sale falso, la entrega se da por vencida SIEMPRE y la suscripcion se
 * entrega la primera vez que el trabajador la mire, a cualquier hora de cualquier dia. Un 99,
 * al reves, la manda tres meses por delante y no se entrega nunca.
 *
 * Que la ruta valide la entrada no basta: en el almacen puede haber suscripciones guardadas
 * antes de que la ruta validara, y una fecha invalida aqui no da error, da una entrega a
 * deshora.
 */
const diaEnRango = (valor: number | undefined, minimo: number, maximo: number): number | undefined =>
  valor !== undefined && Number.isInteger(valor) && valor >= minimo && valor <= maximo
    ? valor
    : undefined;

/** true si la suscripcion tiene una entrega pendiente en el periodo actual. */
export function deliverMust(sub: Subscription, ahora: Date): boolean {
  if (!sub.enabled) return false;
  // Con un archivo ya en cola no se encola otro: dos vueltas seguidas entregarian dos veces.
  if (sub.pendingJobId) return false;

  const home = periodHome(sub.cadence, ahora);

  const programada = new Date(home);
  const semana = diaEnRango(sub.weekday, 0, 6);
  if (sub.cadence === 'semanal' && semana !== undefined) {
    programada.setDate(programada.getDate() + semana);
  }
  const mes = diaEnRango(sub.monthday, 1, 31);
  if (sub.cadence === 'mensual' && mes !== undefined) {
    // Un dia 31 en febrero no existe: se entrega el ultimo dia del mes en vez de saltarse el
    // periodo entero, que es lo que haria una comparacion literal de fecha.
    const lastDay = new Date(programada.getFullYear(), programada.getMonth() + 1, 0).getDate();
    programada.setDate(Math.min(mes, lastDay));
  }
  programada.setHours(diaEnRango(sub.hour, 0, 23) ?? 0, 0, 0, 0);

  if (ahora < programada) return false;

  if (!sub.lastDeliveredAt) return true;
  return new Date(sub.lastDeliveredAt) < programada;
}

/** Descripcion legible de la cadencia, para la interfaz. */
export function cadenceDescribe(sub: Subscription): string {
  const hora = `${String(diaEnRango(sub.hour, 0, 23) ?? 0).padStart(2, '0')}:00`;
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  if (sub.cadence === 'diaria') return `Cada dia a las ${hora}`;
  if (sub.cadence === 'semanal') {
    return `Cada ${dias[diaEnRango(sub.weekday, 0, 6) ?? 1] ?? 'lunes'} a las ${hora}`;
  }
  return `El dia ${diaEnRango(sub.monthday, 1, 31) ?? 1} de cada mes a las ${hora}`;
}
