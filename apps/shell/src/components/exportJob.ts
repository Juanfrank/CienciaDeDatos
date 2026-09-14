/**
 * Encolar una exportacion y seguirla hasta que termina.
 *
 * Vive fuera del componente por la misma razon que `fieldFilterState`: es una maquina de estados
 * con temporizadores y peticiones en vuelo, y eso se prueba con un reloj falso y un `fetch` falso,
 * no montando un navegador. Dentro del componente, la unica forma de comprobar que dos
 * exportaciones lanzadas seguidas no dejan un sondeo huerfano seria pulsar dos veces muy rapido y
 * esperar a ver si algo se rompe.
 *
 * Las dos reglas que impone, y que el control por si solo no imponia:
 *
 * 1. **Una sola exportacion vigente.** Cada lanzamiento se lleva un numero de generacion, y todo
 *    lo que vuelve de una espera comprueba que sigue siendo el vigente antes de tocar nada. Sin
 *    esto, dos lanzamientos solapados —el segundo mientras el POST del primero esta en vuelo—
 *    dejaban DOS intervalos vivos: el primero en armarse no lo guardaba nadie, seguia pidiendo
 *    para siempre, y al terminar cancelaba el sondeo del otro trabajo en vez del suyo.
 * 2. **Una vuelta no se solapa consigo misma.** Si una consulta de estado tarda mas que el
 *    intervalo, la siguiente no se lanza. Es lo mismo que hace el trabajador de fondo del
 *    servidor, y por lo mismo: un servidor lento no se arregla pidiendole mas.
 */

export interface ExportStatus {
  id: string;
  estado: 'encolada' | 'procesando' | 'lista' | 'fallida';
  error?: string;
  archivo?: { nombre: string; bytes: number; descargarEn: string };
}

/** Lo que se pide exportar. Es el cuerpo de la peticion, sin mas. */
export interface ExportOrder {
  modulo: string;
  pagina?: string;
  formato: string;
  filtros: Record<string, string[]>;
}

/** Como se avisa del estado. Lo pone quien llama: aqui no hay pantalla. */
export type ExportReport = (estado: ExportStatus) => void;

export interface TrackerDeps {
  /** El `fetch` a usar. Se inyecta para poder probar sin red. */
  pedir?: typeof fetch;
  /** Cada cuanto se pregunta por el estado. */
  cadaMs?: number;
  /** El reloj. Se inyecta por lo mismo que el `fetch`. */
  programar?: (tarea: () => void, ms: number) => unknown;
  cancelar?: (mango: unknown) => void;
}

export interface ExportTracker {
  /** Encola una exportacion y empieza a seguirla. Cancela la anterior, si la habia. */
  lanzar: (orden: ExportOrder, informar: ExportReport) => Promise<void>;
  /** Deja de seguir. Se llama al desmontar el control. */
  detener: () => void;
}

export const MS_SONDEO = 600;

export const SIN_ENCOLAR = 'No se pudo encolar la exportacion.';
export const DESAPARECIDA = 'La exportacion ya no esta disponible.';

/** Devuelve la respuesta, o `null` si la red fallo. Un sondeo caido no es una excepcion. */
async function intentar(peticion: () => Promise<Response>): Promise<Response | null> {
  try {
    return await peticion();
  } catch {
    return null;
  }
}

export function exportTracker(deps: TrackerDeps = {}): ExportTracker {
  const pedir = deps.pedir ?? ((entrada: RequestInfo | URL, init?: RequestInit) => fetch(entrada, init));
  const cadaMs = deps.cadaMs ?? MS_SONDEO;
  const programar = deps.programar ?? ((tarea: () => void, ms: number) => setInterval(tarea, ms));
  const cancelar =
    deps.cancelar ?? ((mango: unknown) => clearInterval(mango as ReturnType<typeof setInterval>));

  let sondeo: unknown = null;
  let generacion = 0;
  let enCurso = false;

  const detener = (): void => {
    if (sondeo !== null) cancelar(sondeo);
    sondeo = null;
    enCurso = false;
  };

  const vuelta = async (id: string, mia: number, informar: ExportReport): Promise<void> => {
    const respuesta = await intentar(() => pedir(`/api/exports/${id}`));
    if (generacion !== mia) return;

    if (!respuesta?.ok) {
      detener();
      informar({ id, estado: 'fallida', error: DESAPARECIDA });
      return;
    }

    const estado = (await respuesta.json()) as ExportStatus;
    if (generacion !== mia) return;

    informar(estado);
    if (estado.estado === 'lista' || estado.estado === 'fallida') detener();
  };

  const lanzar = async (orden: ExportOrder, informar: ExportReport): Promise<void> => {
    // Se corta lo anterior ANTES de nada, y se toma generacion: a partir de aqui, todo lo que
    // vuelva de una espera con otra generacion se descarta sin tocar el estado.
    detener();
    const mia = ++generacion;

    const respuesta = await intentar(() =>
      pedir('/api/exports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          modulo: orden.modulo,
          pagina: orden.pagina,
          formato: orden.formato,
          filtros: orden.filtros,
        }),
      }),
    );
    if (generacion !== mia) return;

    if (!respuesta?.ok) {
      informar({ id: '', estado: 'fallida', error: SIN_ENCOLAR });
      return;
    }

    const { id } = (await respuesta.json()) as { id: string };
    if (generacion !== mia) return;

    informar({ id, estado: 'encolada' });

    sondeo = programar(() => {
      if (generacion !== mia || enCurso) return;
      enCurso = true;
      void vuelta(id, mia, informar).finally(() => {
        enCurso = false;
      });
    }, cadaMs);
  };

  return { lanzar, detener };
}
