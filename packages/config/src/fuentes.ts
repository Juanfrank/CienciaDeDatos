import {
  CLAVE_CONECTOR,
  banderaDeModulo,
  type FuenteDeConfiguracion,
  type InstantaneaDeConfiguracion,
} from './instantanea';

/* ── Entorno: desarrollo, pruebas y el arranque sin Azure ─────────────────────────────────── */

/**
 * La configuracion que sale de variables de entorno.
 *
 * No es un apaño de desarrollo: es la que corre en las pruebas de navegador y en cualquier
 * despliegue sin App Configuration. Que exista como implementacion del MISMO puerto es lo que
 * permite probar de verdad el apagado de un modulo —hay una prueba que apaga uno y comprueba que
 * desaparece del arbol y que su URL da 404— sin depender de un servicio en la nube.
 *
 *   DATA_CONNECTOR=mock
 *   MODULOS_APAGADOS=casos-pendientes,audiencias
 */
export class ConfiguracionDeEntorno implements FuenteDeConfiguracion {
  readonly nombre = 'entorno';

  constructor(private readonly entorno: NodeJS.ProcessEnv = process.env) {}

  async leer(): Promise<InstantaneaDeConfiguracion> {
    const apagados = (this.entorno['MODULOS_APAGADOS'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const conector = this.entorno['DATA_CONNECTOR'];

    return {
      banderas: Object.fromEntries(apagados.map((slug) => [banderaDeModulo(slug), false])),
      valores: conector ? { [CLAVE_CONECTOR]: conector } : {},
      leidaEn: new Date().toISOString(),
    };
  }
}

/* ── Azure App Configuration ──────────────────────────────────────────────────────────────── */

/** Como App Configuration guarda una bandera: una clave con prefijo y un JSON con `enabled`. */
const PREFIJO_BANDERA = '.appconfig.featureflag/';

interface ParDeClaveValor {
  key: string;
  value?: string;
  content_type?: string;
}

export interface OpcionesDeAppConfiguration {
  /** `https://<tienda>.azconfig.io`, el mismo que el Bicep pasa como APP_CONFIG_ENDPOINT. */
  endpoint: string;
  /**
   * Devuelve un token de acceso para el plano de datos.
   *
   * Se inyecta en vez de construir aqui `DefaultAzureCredential` para que el analisis de la
   * respuesta —que es donde de verdad se puede fallar— se pueda probar con un `fetch` de mentira
   * y sin nube. Quien lo cablea es `configuracionDeAzure()`.
   */
  obtenerToken: () => Promise<string>;
  /** Etiqueta de App Configuration, si se separan entornos por etiqueta. */
  etiqueta?: string;
  buscar?: typeof fetch;
}

/**
 * Lee la instantanea de Azure App Configuration por su API REST.
 *
 * Por REST y no con `@azure/app-configuration` a proposito: `@azure/identity` ya es dependencia
 * del proyecto y el plano de datos son dos llamadas HTTP. Anadir un paquete mas a una aplicacion
 * que se despliega en un entorno cerrado tiene un coste —revision, renovacion, superficie— que no
 * compensa por un `GET` con paginacion.
 */
export class AppConfiguration implements FuenteDeConfiguracion {
  readonly nombre = 'app-configuration';

  constructor(private readonly opciones: OpcionesDeAppConfiguration) {}

  async leer(): Promise<InstantaneaDeConfiguracion> {
    const token = await this.opciones.obtenerToken();
    const buscar = this.opciones.buscar ?? fetch;
    const banderas: Record<string, boolean> = {};
    const valores: Record<string, string> = {};

    const base = this.opciones.endpoint.replace(/\/$/, '');
    const etiqueta = this.opciones.etiqueta ? `&label=${encodeURIComponent(this.opciones.etiqueta)}` : '';
    // `\0` es como App Configuration pide «sin etiqueta»; sin esto, una tienda con etiquetas
    // devolveria tambien las de otros entornos.
    let url: string | null = `${base}/kv?key=*&label=${this.opciones.etiqueta ? '' : '%00'}${etiqueta}&api-version=2023-11-01`;

    // Paginada: una tienda con muchas claves devuelve `@nextLink`, y quedarse en la primera
    // pagina dejaria banderas fuera — que se leerian como «ausente», o sea encendido.
    while (url) {
      const respuesta = await buscar(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!respuesta.ok) {
        throw new Error(`App Configuration respondio ${respuesta.status} ${respuesta.statusText}`);
      }
      const cuerpo = (await respuesta.json()) as { items?: ParDeClaveValor[]; '@nextLink'?: string };

      for (const par of cuerpo.items ?? []) {
        if (par.key.startsWith(PREFIJO_BANDERA)) {
          const nombre = par.key.slice(PREFIJO_BANDERA.length);
          banderas[nombre] = leerBandera(par.value);
        } else if (par.value !== undefined) {
          valores[par.key] = par.value;
        }
      }

      url = cuerpo['@nextLink'] ? `${base}${cuerpo['@nextLink']}` : null;
    }

    return { banderas, valores, leidaEn: new Date().toISOString() };
  }
}

/**
 * `enabled` de una bandera.
 *
 * Un JSON que no se puede leer cuenta como ENCENDIDA, no como apagada. Apagar por no saber
 * interpretar un valor convertiria un error de formato en una caida de modulo, y el sintoma
 * —«el modulo desaparecio»— no diria nada de la causa.
 */
function leerBandera(valor: string | undefined): boolean {
  if (!valor) return true;
  try {
    const parseada = JSON.parse(valor) as { enabled?: unknown };
    return parseada.enabled !== false;
  } catch {
    return true;
  }
}
