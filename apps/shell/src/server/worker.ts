import { pendientesProcess } from '@app/export';
import { subscriptionsServe, evaluateIfHasDatumNew } from './alerts';
import { queueExports, resolverObjects } from './exports';

/** Trabajador de fondo del shell. */

const INTERVAL_QUEUE_MS = 500;
const INTERVAL_ALERTS_MS = 5_000;
const INTERVAL_SUBSCRIPTIONS_MS = 60_000;

/** Los temporizadores se cuelgan de globalThis: la recarga en caliente crearia uno por recarga. */
const KEY = '__trabajadorDeFondo';

/** Ejecuta una tarea en bucle sin solaparla consigo misma. */
function enBucle(nombre: string, msInterval: number, tarea: () => Promise<unknown>) {
  let enCurso = false;

  const temporizador = setInterval(() => {
    if (enCurso) return;
    enCurso = true;
    void tarea()
      .catch((error: unknown) => {
        console.error(`[${nombre}] fallo la vuelta del trabajador`, error);
      })
      .finally(() => {
        enCurso = false;
      });
  }, msInterval);

  // No mantiene vivo el proceso por si solo: si el servidor termina, el trabajador se va con el.
  temporizador.unref?.();
  return temporizador;
}

export function backgroundWorkerStart(): void {
  const global = globalThis as Record<string, unknown>;
  if (global[KEY]) return;

  global[KEY] = [
    enBucle('exportaciones', INTERVAL_QUEUE_MS, () =>
      pendientesProcess(queueExports, resolverObjects),
    ),
    enBucle('alertas', INTERVAL_ALERTS_MS, () => evaluateIfHasDatumNew()),
    enBucle('suscripciones', INTERVAL_SUBSCRIPTIONS_MS, () => subscriptionsServe()),
  ];
}
