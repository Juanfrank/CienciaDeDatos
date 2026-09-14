import {
  CONNECTOR_KEY,
  moduleFlag,
  type SettingsFont,
  type SettingsSnapshot,
} from './snapshot';

/* ── Entorno: desarrollo, pruebas y el arranque sin Azure ─────────────────────────────────── */

/** La configuracion que sale de variables de entorno. */
export class EnvironmentSettings implements SettingsFont {
  readonly nombre = 'entorno';

  constructor(private readonly entorno: NodeJS.ProcessEnv = process.env) {}

  async leer(): Promise<SettingsSnapshot> {
    const disabled = (this.entorno['MODULOS_APAGADOS'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const conector = this.entorno['DATA_CONNECTOR'];

    return {
      banderas: Object.fromEntries(disabled.map((slug) => [moduleFlag(slug), false])),
      valores: conector ? { [CONNECTOR_KEY]: conector } : {},
      leidaEn: new Date().toISOString(),
    };
  }
}

/* ── Azure App Configuration ──────────────────────────────────────────────────────────────── */

/** Como App Configuration guarda una bandera: una clave con prefijo y un JSON con `enabled`. */
const FLAG_PREFIX = '.appconfig.featureflag/';

interface ValueKeyPair {
  key: string;
  value?: string;
  content_type?: string;
}

export interface ConfigurationAppOptions {
  /** `https://<tienda>.azconfig.io`, el mismo que el Bicep pasa como APP_CONFIG_ENDPOINT. */
  endpoint: string;
  /** Devuelve un token de acceso para el plano de datos. */
  tokenGet: () => Promise<string>;
  /** Etiqueta de App Configuration, si se separan entornos por etiqueta. */
  etiqueta?: string;
  search?: typeof fetch;
}

/** Lee la instantanea de Azure App Configuration por su API REST. */
export class AppConfiguration implements SettingsFont {
  readonly nombre = 'app-configuration';

  constructor(private readonly opciones: ConfigurationAppOptions) {}

  async leer(): Promise<SettingsSnapshot> {
    const token = await this.opciones.tokenGet();
    const search = this.opciones.search ?? fetch;
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
      const respuesta = await search(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!respuesta.ok) {
        throw new Error(`App Configuration respondio ${respuesta.status} ${respuesta.statusText}`);
      }
      const body = (await respuesta.json()) as { items?: ValueKeyPair[]; '@nextLink'?: string };

      for (const pair of body.items ?? []) {
        if (pair.key.startsWith(FLAG_PREFIX)) {
          const nombre = pair.key.slice(FLAG_PREFIX.length);
          banderas[nombre] = readFlag(pair.value);
        } else if (pair.value !== undefined) {
          valores[pair.key] = pair.value;
        }
      }

      url = body['@nextLink'] ? `${base}${body['@nextLink']}` : null;
    }

    return { banderas, valores, leidaEn: new Date().toISOString() };
  }
}

/** `enabled` de una bandera. */
function readFlag(valor: string | undefined): boolean {
  if (!valor) return true;
  try {
    const parseada = JSON.parse(valor) as { enabled?: unknown };
    return parseada.enabled !== false;
  } catch {
    return true;
  }
}
