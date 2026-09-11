import { procesarPendientes } from '@app/export';
import { colaExportaciones, resolverObjetos } from './exportaciones';

/**
 * Trabajador de la cola de exportaciones.
 *
 * Corre FUERA del ciclo de solicitud HTTP (5.3): lo arranca `instrumentation.ts` una vez por
 * proceso y desde entonces vacia la cola por su cuenta. Ninguna solicitud espera a que termine
 * un archivo; quien exporta recibe un identificador y consulta el estado.
 *
 * En Azure este bucle no existe: lo sustituye una Function con disparador de cola, que llama a
 * la MISMA `procesarPendientes` con el mismo resolutor. Aqui vive en el proceso del shell porque
 * en desarrollo el gobierno esta en memoria de ese proceso y otro proceso no podria resolver el
 * ambito de quien pidio la exportacion — y exportar sin resolver el ambito no es una opcion.
 */

const INTERVALO_MS = 500;

/** El temporizador se cuelga de globalThis: la recarga en caliente crearia uno por recarga. */
const clave = '__trabajadorExportaciones';

export function iniciarTrabajadorDeExportaciones(): void {
  const global = globalThis as Record<string, unknown>;
  if (global[clave]) return;

  let enCurso = false;
  const temporizador = setInterval(() => {
    // Sin este pestillo, una vuelta lenta se solaparia con la siguiente y dos trabajadores
    // tomarian trabajos a la vez sobre un store que no ofrece lectura-modificacion atomica.
    if (enCurso) return;
    enCurso = true;
    void procesarPendientes(colaExportaciones, resolverObjetos)
      .catch((error: unknown) => {
        console.error('[exportaciones] fallo la vuelta del trabajador', error);
      })
      .finally(() => {
        enCurso = false;
      });
  }, INTERVALO_MS);

  // No mantiene vivo el proceso por si solo: si el servidor termina, el trabajador se va con el.
  temporizador.unref?.();
  global[clave] = temporizador;
}
