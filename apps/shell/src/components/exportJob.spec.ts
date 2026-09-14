import { describe, expect, it } from 'vitest';
import {
  DESAPARECIDA,
  SIN_ENCOLAR,
  exportTracker,
  type ExportOrder,
  type ExportStatus,
} from './exportJob';

/**
 * El seguimiento de una exportacion, probado con un reloj falso y una red falsa.
 *
 * Lo que se fija aqui no se ve mirando la pantalla: que no queden sondeos huerfanos. Un intervalo
 * que nadie cancela no rompe nada visible —sigue preguntando por un trabajo que ya termino— pero
 * no para nunca, escribe encima del estado del trabajo que si importa, y se lleva una peticion al
 * servidor cada seis decimas mientras la pestana este abierta.
 */

const ORDEN: ExportOrder = { modulo: 'composicion', formato: 'csv', filtros: {} };

/** Una respuesta con cuerpo, sin montar un `Response` de verdad. */
const conCuerpo = (cuerpo: unknown): Response =>
  ({ ok: true, json: async () => cuerpo }) as unknown as Response;
const caida = (): Response => ({ ok: false, json: async () => ({}) }) as unknown as Response;

/** Peticiones que se quedan en vuelo hasta que la prueba decide contestarlas. */
function red() {
  const vuelo: Array<{ url: string; cumplir: (r: Response) => void }> = [];
  const pedir = ((entrada: RequestInfo | URL) =>
    new Promise<Response>((cumplir) => {
      vuelo.push({ url: String(entrada), cumplir });
    })) as unknown as typeof fetch;
  return { vuelo, pedir };
}

/** El reloj. `vivos` es la cuenta que delata un sondeo que nadie cancelo. */
function reloj() {
  const tareas = new Map<number, () => void>();
  let ultimo = 0;
  return {
    programar: (tarea: () => void) => {
      tareas.set(++ultimo, tarea);
      return ultimo;
    },
    cancelar: (mango: unknown) => {
      tareas.delete(mango as number);
    },
    tic: () => {
      for (const tarea of [...tareas.values()]) tarea();
    },
    vivos: () => tareas.size,
  };
}

/** Deja correr las microtareas pendientes: la maquina encadena varios `await`. */
const respirar = (): Promise<void> => new Promise((listo) => setTimeout(listo, 0));

function montar() {
  const { vuelo, pedir } = red();
  const tiempo = reloj();
  const dichos: ExportStatus[] = [];
  const seguidor = exportTracker({
    pedir,
    programar: tiempo.programar,
    cancelar: tiempo.cancelar,
  });
  return { vuelo, tiempo, dichos, seguidor, informar: (e: ExportStatus) => dichos.push(e) };
}

describe('seguimiento de una exportacion', () => {
  it('encola, sondea y para cuando la exportacion esta lista', async () => {
    const { vuelo, tiempo, dichos, seguidor, informar } = montar();

    void seguidor.lanzar(ORDEN, informar);
    await respirar();
    expect(vuelo[0]?.url).toBe('/api/exports');

    vuelo[0]?.cumplir(conCuerpo({ id: 'e1' }));
    await respirar();
    expect(dichos).toEqual([{ id: 'e1', estado: 'encolada' }]);
    expect(tiempo.vivos()).toBe(1);

    tiempo.tic();
    await respirar();
    expect(vuelo[1]?.url).toBe('/api/exports/e1');
    vuelo[1]?.cumplir(conCuerpo({ id: 'e1', estado: 'procesando' }));
    await respirar();
    expect(tiempo.vivos()).toBe(1);

    tiempo.tic();
    await respirar();
    vuelo[2]?.cumplir(conCuerpo({ id: 'e1', estado: 'lista' }));
    await respirar();

    expect(dichos.at(-1)).toMatchObject({ estado: 'lista' });
    // Terminada la exportacion, el sondeo se va con ella.
    expect(tiempo.vivos()).toBe(0);
  });

  it('dos lanzamientos SOLAPADOS dejan un solo sondeo, no dos', async () => {
    // La carrera: se pulsa «Generar» dos veces seguidas y el POST del primero sigue en vuelo.
    // Sin generacion, el primero en volver arma su intervalo, el segundo lo sobrescribe en la
    // referencia, y el que quedo sin referencia no lo cancela ya nadie: pide para siempre.
    const { vuelo, tiempo, dichos, seguidor, informar } = montar();

    void seguidor.lanzar(ORDEN, informar);
    await respirar();
    void seguidor.lanzar({ ...ORDEN, formato: 'pdf' }, informar);
    await respirar();

    const primero = vuelo[0];
    const segundo = vuelo[1];
    expect(primero && segundo).toBeTruthy();

    // El segundo contesta antes; el primero llega tarde, cuando ya no es el vigente.
    segundo?.cumplir(conCuerpo({ id: 'nuevo' }));
    await respirar();
    primero?.cumplir(conCuerpo({ id: 'viejo' }));
    await respirar();

    expect(tiempo.vivos()).toBe(1);
    // Y el que llego tarde no escribe el estado: diria «en cola» de un trabajo abandonado.
    expect(dichos).toEqual([{ id: 'nuevo', estado: 'encolada' }]);

    // El unico sondeo vivo es el del trabajo vigente.
    tiempo.tic();
    await respirar();
    expect(vuelo.at(-1)?.url).toBe('/api/exports/nuevo');
  });

  it('una vuelta lenta no se solapa consigo misma', async () => {
    // Si el servidor tarda mas que el intervalo, pedirle mas no lo hace ir mas rapido.
    const { vuelo, tiempo, dichos, seguidor, informar } = montar();

    void seguidor.lanzar(ORDEN, informar);
    await respirar();
    vuelo[0]?.cumplir(conCuerpo({ id: 'e1' }));
    await respirar();

    tiempo.tic();
    await respirar();
    const consultas = vuelo.length;

    tiempo.tic();
    tiempo.tic();
    await respirar();
    expect(vuelo.length).toBe(consultas);

    // Contestada la que estaba, la siguiente vuelta si pregunta.
    vuelo[consultas - 1]?.cumplir(conCuerpo({ id: 'e1', estado: 'procesando' }));
    await respirar();
    tiempo.tic();
    await respirar();
    expect(vuelo.length).toBe(consultas + 1);
    expect(dichos.at(-1)).toMatchObject({ estado: 'procesando' });
  });

  it('detener corta el sondeo: salir de la pagina no deja nada corriendo', async () => {
    const { vuelo, tiempo, seguidor, informar } = montar();

    void seguidor.lanzar(ORDEN, informar);
    await respirar();
    vuelo[0]?.cumplir(conCuerpo({ id: 'e1' }));
    await respirar();
    expect(tiempo.vivos()).toBe(1);

    seguidor.detener();
    expect(tiempo.vivos()).toBe(0);
  });

  it('un encolado que el servidor rechaza no arma ningun sondeo', async () => {
    const { vuelo, tiempo, dichos, seguidor, informar } = montar();

    void seguidor.lanzar(ORDEN, informar);
    await respirar();
    vuelo[0]?.cumplir(caida());
    await respirar();

    expect(dichos).toEqual([{ id: '', estado: 'fallida', error: SIN_ENCOLAR }]);
    expect(tiempo.vivos()).toBe(0);
  });

  it('un trabajo que desaparece se dice y se deja de sondear', async () => {
    const { vuelo, tiempo, dichos, seguidor, informar } = montar();

    void seguidor.lanzar(ORDEN, informar);
    await respirar();
    vuelo[0]?.cumplir(conCuerpo({ id: 'e1' }));
    await respirar();
    tiempo.tic();
    await respirar();
    vuelo[1]?.cumplir(caida());
    await respirar();

    expect(dichos.at(-1)).toEqual({ id: 'e1', estado: 'fallida', error: DESAPARECIDA });
    expect(tiempo.vivos()).toBe(0);
  });

  it('la red caida no rompe el control: se informa y no queda sondeo', async () => {
    // `fetch` lanza cuando no hay red. Sin capturarlo, la promesa rechazada sube sin dueno.
    const tiempo = reloj();
    const dichos: ExportStatus[] = [];
    const seguidor = exportTracker({
      pedir: (() => Promise.reject(new Error('sin red'))) as unknown as typeof fetch,
      programar: tiempo.programar,
      cancelar: tiempo.cancelar,
    });

    await seguidor.lanzar(ORDEN, (e) => dichos.push(e));

    expect(dichos).toEqual([{ id: '', estado: 'fallida', error: SIN_ENCOLAR }]);
    expect(tiempo.vivos()).toBe(0);
  });
});
