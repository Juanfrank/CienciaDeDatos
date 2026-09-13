import type { ICacheStore } from '@app/caching';
import {
  INSTANTANEA_VACIA,
  type FuenteDeConfiguracion,
  type InstantaneaDeConfiguracion,
} from './instantanea';

/** Sirve la instantanea vigente, con refresco y con memoria. */

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
