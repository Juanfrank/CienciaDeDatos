/**
 * Metricas del camino de lectura — seccion 8.3: "estrategia de cache implementada y con METRICAS
 * VISIBLES en Application Insights".
 */

export interface LecturaDeCache {
  datasetId: string;
  /** Los mismos tres estados que emite el lector de datasets. */
  status: 'ok' | 'generating' | 'degraded';
  servedFrom?: 'l1' | 'l2';
  stale: boolean;
  ageMs?: number;
}

export interface ResumenDeCache {
  total: number;
  aciertos: number;
  generandose: number;
  desdeL1: number;
  desdeL2: number;
  degradados: number;
  antiguedadMaximaMs: number;
  /** Proporcion de lecturas servidas con dato, de 0 a 1. `null` si todavia no hubo ninguna. */
  tasaDeAcierto: number | null;
}

export class CacheMetrics {
  private total = 0;
  private aciertos = 0;
  private generandose = 0;
  private desdeL1 = 0;
  private desdeL2 = 0;
  private degradados = 0;
  private antiguedadMaximaMs = 0;

  registrar(lectura: LecturaDeCache): void {
    this.total += 1;

    if (lectura.status === 'generating') {
      this.generandose += 1;
      // Una lectura sin dato no cuenta como acierto ni tiene procedencia ni antiguedad: sumarla
      // a cualquiera de las otras cifras las volveria mentira.
      return;
    }

    this.aciertos += 1;
    if (lectura.servedFrom === 'l1') this.desdeL1 += 1;
    if (lectura.servedFrom === 'l2') this.desdeL2 += 1;
    if (lectura.stale || lectura.status === 'degraded') this.degradados += 1;
    if (lectura.ageMs !== undefined) {
      this.antiguedadMaximaMs = Math.max(this.antiguedadMaximaMs, lectura.ageMs);
    }
  }

  resumen(): ResumenDeCache {
    return {
      total: this.total,
      aciertos: this.aciertos,
      generandose: this.generandose,
      desdeL1: this.desdeL1,
      desdeL2: this.desdeL2,
      degradados: this.degradados,
      antiguedadMaximaMs: this.antiguedadMaximaMs,
      tasaDeAcierto: this.total === 0 ? null : this.aciertos / this.total,
    };
  }

  /** Solo para pruebas y para el reinicio de un proceso. */
  reiniciar(): void {
    this.total = 0;
    this.aciertos = 0;
    this.generandose = 0;
    this.desdeL1 = 0;
    this.desdeL2 = 0;
    this.degradados = 0;
    this.antiguedadMaximaMs = 0;
  }
}
