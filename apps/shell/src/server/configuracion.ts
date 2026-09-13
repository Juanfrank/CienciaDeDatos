import { DefaultAzureCredential } from '@azure/identity';
import {
  AppConfiguration,
  CLAVE_CONECTOR,
  ConfiguracionDeEntorno,
  ResolutorDeConfiguracion,
  moduloHabilitado,
  modulosApagados,
  type SettingsFont,
} from '@app/config';
import { cacheL2 } from './almacenCompartido';

/** Configuracion en ejecucion del shell — seccion 3.4 y 2.2. */

const endpoint = process.env['APP_CONFIG_ENDPOINT'];

function source(): SettingsFont {
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

/** Vive en `globalThis` como el resto del estado de proceso. */
const global = globalThis as typeof globalThis & { __config?: ResolutorDeConfiguracion };

function nuevoResolutor(): ResolutorDeConfiguracion {
  return new ResolutorDeConfiguracion({
    source: source(),
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

/** El conector activo (2.2). */
export async function conectorActivo(): Promise<string> {
  const instantanea = await resolutor().instantanea();
  return instantanea.valores[CLAVE_CONECTOR] ?? 'mock';
}

/** Descarta el resolutor vigente. */
export function reiniciarConfiguracion(): void {
  delete global.__config;
}
