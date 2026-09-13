import { DefaultAzureCredential } from '@azure/identity';
import {
  AppConfiguration,
  CLAVE_CONECTOR,
  ConfiguracionDeEntorno,
  ResolutorDeConfiguracion,
  moduloHabilitado,
  modulosApagados,
  type FuenteDeConfiguracion,
} from '@app/config';
import { cacheL2 } from './almacenCompartido';

/**
 * Configuracion en ejecucion del shell — seccion 3.4 y 2.2.
 *
 * La fuente se elige por si hay endpoint, no por una variable de «entorno» que haya que acordarse
 * de poner: si el Bicep paso `APP_CONFIG_ENDPOINT`, se lee de Azure; si no, del entorno. Asi el
 * mismo binario corre en local, en las pruebas de navegador y en produccion sin ramas por entorno
 * —que son las que acaban comportandose distinto justo donde no se puede depurar—.
 */

const endpoint = process.env['APP_CONFIG_ENDPOINT'];

function fuente(): FuenteDeConfiguracion {
  if (!endpoint) return new ConfiguracionDeEntorno();

  // La credencial se construye una vez y se reutiliza: renueva el token por dentro, y crear una
  // por lectura descartaria esa cache y pediria token a AAD cada treinta segundos.
  const credencial = new DefaultAzureCredential();
  return new AppConfiguration({
    endpoint,
    obtenerToken: async () => {
      const token = await credencial.getToken('https://azconfig.io/.default');
      if (!token) throw new Error('Sin token para App Configuration');
      return token.token;
    },
  });
}

/**
 * Vive en `globalThis` como el resto del estado de proceso.
 *
 * La recarga en caliente del servidor de desarrollo reevalua los modulos, y con una constante de
 * modulo cada recarga estrenaria resolutor —y con el, credencial y cache— varias veces por minuto.
 */
const global = globalThis as typeof globalThis & { __config?: ResolutorDeConfiguracion };

function nuevoResolutor(): ResolutorDeConfiguracion {
  return new ResolutorDeConfiguracion({
    fuente: fuente(),
    // La ultima foto buena se guarda en el almacen COMPARTIDO, no en memoria: si App
    // Configuration cae y una instancia se recicla, la nueva tiene que arrancar sabiendo que
    // modulos estaban apagados. Con memoria por proceso, los reencenderia.
    memoria: cacheL2,
    alFallar: (error) => {
      // Sin nivel de error: degradar a la ultima foto buena es el comportamiento previsto, no una
      // averia. Pero tiene que constar, porque si dura, la configuracion que se sirve envejece.
      console.warn('[config] no se pudo leer la configuracion, se sirve la ultima conocida', error);
    },
  });
}

const resolutor = (): ResolutorDeConfiguracion => (global.__config ??= nuevoResolutor());

/** Si un modulo esta encendido. Ausente en la configuracion significa encendido. */
export async function moduloEncendido(slug: string): Promise<boolean> {
  return moduloHabilitado(await resolutor().instantanea(), slug);
}

/** Los apagados, para que el panel de administracion pueda DECIR cuales y por que falta uno. */
export async function slugsApagados(): Promise<string[]> {
  return modulosApagados(await resolutor().instantanea());
}

/**
 * El conector activo (2.2).
 *
 * Sale de la configuracion en ejecucion, no de una variable horneada en el contenedor: cambiar
 * entre mock, sql y xmla no debe requerir redespliegue, que es lo que el propio Bicep declara.
 * `DATA_CONNECTOR` sigue funcionando como respaldo local a traves de `ConfiguracionDeEntorno`.
 */
export async function conectorActivo(): Promise<string> {
  const instantanea = await resolutor().instantanea();
  return instantanea.valores[CLAVE_CONECTOR] ?? 'mock';
}

/**
 * Descarta el resolutor vigente.
 *
 * Existe para las PRUEBAS: el resolutor cachea treinta segundos, asi que sin esto una prueba que
 * apaga un modulo leeria la foto que dejo la anterior. No lo llama ningun camino de produccion —
 * alli el TTL es precisamente lo que se quiere—.
 */
export function reiniciarConfiguracion(): void {
  delete global.__config;
}
