import type { ICacheStore } from '@app/caching';
import {
  INSTANTANEA_VACIA,
  type FuenteDeConfiguracion,
  type InstantaneaDeConfiguracion,
} from './instantanea';

/**
 * Sirve la instantanea vigente, con refresco y con memoria.
 *
 * Tres decisiones, y ninguna es de rendimiento:
 *
 * **TTL corto (30 s).** «Desactivar un modulo en produccion sin redeploy» solo significa algo si
 * surte efecto en segundos. Un TTL de minutos convierte el interruptor de emergencia en un
 * tramite, y entonces la gente reinicia la aplicacion, que es justo lo que el requisito evita.
 *
 * **Ante un fallo, el ULTIMO VALOR CONOCIDO.** Si App Configuration no responde, lo que no puede
 * pasar es que un modulo apagado a proposito —porque esta dando cifras malas— se vuelva a
 * encender solo. Servir la ultima foto buena es lo unico que conserva esa decision.
 *
 * **La ultima foto se PERSISTE en el almacen compartido.** Sin eso, un reinicio durante la caida
 * —que es justo cuando hay reinicios— dejaria a la instancia nueva sin memoria y volveria a
 * encender lo apagado. Ademas hace que todas las instancias arranquen con la misma foto en vez de
 * cada una con la suya.
 *
 * Y lo que pasa cuando NO hay ninguna foto, ni fresca ni guardada: se abre todo. El estado por
 * defecto de un modulo es encendido, y dejar el portal en blanco porque el servicio de banderas
 * no contesta seria convertir una dependencia auxiliar en un punto unico de fallo.
 */

export const CLAVE_ULTIMA_INSTANTANEA = 'config:ultima-instantanea';

export interface OpcionesDelResolutor {
  fuente: FuenteDeConfiguracion;
  /** Donde recordar la ultima foto buena. Sin el, la memoria dura lo que el proceso. */
  memoria?: ICacheStore;
  ttlMs?: number;
  /** Inyectable para poder probar el vencimiento sin esperar treinta segundos. */
  ahora?: () => number;
  /** Para registrar la degradacion. Que falle en silencio es como se descubre tarde. */
  alFallar?: (error: unknown) => void;
}

export class ResolutorDeConfiguracion {
  private vigente: InstantaneaDeConfiguracion | null = null;
  private leidaEnMs = 0;
  /** Una lectura en vuelo se comparte: diez peticiones a la vez no hacen diez viajes. */
  private enVuelo: Promise<InstantaneaDeConfiguracion> | null = null;
  private readonly ttlMs: number;
  private readonly ahora: () => number;

  constructor(private readonly opciones: OpcionesDelResolutor) {
    this.ttlMs = opciones.ttlMs ?? 30_000;
    this.ahora = opciones.ahora ?? Date.now;
  }

  async instantanea(): Promise<InstantaneaDeConfiguracion> {
    if (this.vigente && this.ahora() - this.leidaEnMs < this.ttlMs) return this.vigente;
    this.enVuelo ??= this.refrescar().finally(() => {
      this.enVuelo = null;
    });
    return this.enVuelo;
  }

  private async refrescar(): Promise<InstantaneaDeConfiguracion> {
    try {
      const leida = await this.opciones.fuente.leer();
      this.vigente = leida;
      this.leidaEnMs = this.ahora();
      // Se guarda DESPUES de servirla, y un fallo al guardar no tumba la lectura: la memoria es
      // una red de seguridad, no parte del camino.
      void this.opciones.memoria
        ?.set(CLAVE_ULTIMA_INSTANTANEA, { value: leida, generatedAt: leida.leidaEn })
        .catch(() => undefined);
      return leida;
    } catch (error) {
      this.opciones.alFallar?.(error);

      if (this.vigente) return this.vigente;

      const guardada = await this.opciones.memoria
        ?.get<InstantaneaDeConfiguracion>(CLAVE_ULTIMA_INSTANTANEA)
        .catch(() => null);
      if (guardada?.value) {
        this.vigente = guardada.value;
        // NO se marca como fresca: el TTL sigue vencido, asi que el siguiente intento vuelve a
        // ir a la fuente. Marcarla congelaria la foto vieja durante otros treinta segundos.
        return guardada.value;
      }

      return INSTANTANEA_VACIA;
    }
  }

  /** Para las pruebas y para un `/health` que quiera decir si la configuracion esta fresca. */
  edadMs(): number | null {
    return this.vigente ? this.ahora() - this.leidaEnMs : null;
  }
}
