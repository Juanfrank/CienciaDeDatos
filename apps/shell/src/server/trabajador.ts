import { procesarPendientes } from '@app/export';
import { atenderSuscripciones, evaluarSiHayDatoNuevo } from './alertas';
import { colaExportaciones, resolverObjetos } from './exportaciones';

/**
 * Trabajador de fondo del shell.
 *
 * Corre FUERA del ciclo de solicitud HTTP (5.3): lo arranca `instrumentation.ts` una vez por
 * proceso. Atiende tres cosas con ritmos distintos, y la diferencia de ritmo es el punto:
 *
 * - La COLA DE EXPORTACION se vacia a menudo, porque alguien esta esperando su archivo.
 * - Las ALERTAS se evaluan cuando el job deja un latido NUEVO en el cache, no por reloj: son
 *   alertas basadas en datos, y el dato solo cambia cuando termina un ciclo de poblacion.
 * - Las SUSCRIPCIONES se revisan cada pocos minutos, que es resolucion de sobra para una
 *   cadencia diaria o semanal.
 *
 * En Azure este bucle no existe: lo sustituyen una Function con disparador de cola para las
 * exportaciones y otra encadenada al ciclo de poblacion para las alertas, llamando a las MISMAS
 * funciones. Aqui vive en el proceso del shell porque en desarrollo el gobierno esta en memoria
 * de ese proceso, y sin gobierno no se puede resolver el ambito de quien creo una alerta —
 * evaluar una alerta sin ambito no es una opcion.
 */

const INTERVALO_COLA_MS = 500;
const INTERVALO_ALERTAS_MS = 5_000;
const INTERVALO_SUSCRIPCIONES_MS = 60_000;

/** Los temporizadores se cuelgan de globalThis: la recarga en caliente crearia uno por recarga. */
const CLAVE = '__trabajadorDeFondo';

/**
 * Ejecuta una tarea en bucle sin solaparla consigo misma.
 *
 * El pestillo importa: sin el, una vuelta lenta se solaparia con la siguiente y dos pasadas
 * tomarian trabajos a la vez sobre un store que no ofrece lectura-modificacion atomica.
 */
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
