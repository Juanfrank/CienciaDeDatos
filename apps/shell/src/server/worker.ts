import { pendientesProcess } from '@app/export';
import { atenderSuscripciones, evaluarSiHayDatoNuevo } from './alerts';
import { queueExports, resolverObjetos } from './exports';

/** Trabajador de fondo del shell. */

const INTERVALO_COLA_MS = 500;
const INTERVALO_ALERTAS_MS = 5_000;
const INTERVALO_SUSCRIPCIONES_MS = 60_000;

/** Los temporizadores se cuelgan de globalThis: la recarga en caliente crearia uno por recarga. */
const KEY = '__trabajadorDeFondo';

/** Ejecuta una tarea en bucle sin solaparla consigo misma. */
function enBucle(nombre: string, intervaloMs: number, tarea: () => Promise<unknown>) {
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
  }, intervaloMs);

  // No mantiene vivo el proceso por si solo: si el servidor termina, el trabajador se va con el.
  temporizador.unref?.();
  return temporizador;
}

export function iniciarTrabajadorDeFondo(): void {
  const global = globalThis as Record<string, unknown>;
  if (global[KEY]) return;

  global[KEY] = [
    enBucle('exportaciones', INTERVALO_COLA_MS, () =>
      pendientesProcess(queueExports, resolverObjetos),
    ),
    enBucle('alertas', INTERVALO_ALERTAS_MS, () => evaluarSiHayDatoNuevo()),
    enBucle('suscripciones', INTERVALO_SUSCRIPCIONES_MS, () => atenderSuscripciones()),
  ];
}
