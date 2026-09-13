import { procesarPendientes } from '@app/export';
import { atenderSuscripciones, evaluarSiHayDatoNuevo } from './alertas';
import { colaExportaciones, resolverObjetos } from './exportaciones';

/** Trabajador de fondo del shell. */

const INTERVALO_COLA_MS = 500;
const INTERVALO_ALERTAS_MS = 5_000;
const INTERVALO_SUSCRIPCIONES_MS = 60_000;

/** Los temporizadores se cuelgan de globalThis: la recarga en caliente crearia uno por recarga. */
const CLAVE = '__trabajadorDeFondo';

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
  if (global[CLAVE]) return;

  global[CLAVE] = [
    enBucle('exportaciones', INTERVALO_COLA_MS, () =>
      procesarPendientes(colaExportaciones, resolverObjetos),
    ),
    enBucle('alertas', INTERVALO_ALERTAS_MS, () => evaluarSiHayDatoNuevo()),
    enBucle('suscripciones', INTERVALO_SUSCRIPCIONES_MS, () => atenderSuscripciones()),
  ];
}
